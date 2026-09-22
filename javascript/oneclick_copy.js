(() => {
    "use strict";

    const ENDPOINT = "/oneclick-copy/copy";
    const BUTTON_ID_PREFIX = "oneclick_copy_";

    function appRoot() {
        try {
            return typeof gradioApp === "function" ? gradioApp() : document;
        } catch (_) {
            return document;
        }
    }

    function getGallery(tab) {
        return appRoot().querySelector(`#${tab}_gallery`);
    }

    function selectedIndex() {
        try {
            if (typeof selected_gallery_index === "function") {
                const n = Number(selected_gallery_index());
                return Number.isFinite(n) ? Math.max(0, n) : 0;
            }
        } catch (_) {}
        return 0;
    }

    function selectedImage(tab) {
        const gallery = getGallery(tab);
        if (!gallery) return null;

        const selectedSelectors = [
            ".thumbnail-item.selected img",
            ".thumbnail-item[aria-selected='true'] img",
            "button.selected img",
            "button[aria-selected='true'] img",
            ".gallery-item.selected img",
            ".gallery-item[aria-selected='true'] img"
        ];
        for (const selector of selectedSelectors) {
            const img = gallery.querySelector(selector);
            if (img && (img.currentSrc || img.src)) return img;
        }

        const thumbs = Array.from(gallery.querySelectorAll(".thumbnail-item img, button.thumbnail-item img"));
        const idx = selectedIndex();
        if (thumbs.length && thumbs[idx]) return thumbs[idx];

        const preview = gallery.querySelector(".preview img, .gallery-preview img, img");
        return preview && (preview.currentSrc || preview.src) ? preview : null;
    }

    function filenameFromUrl(src, blob) {
        try {
            const u = new URL(src, window.location.href);
            let path = decodeURIComponent(u.pathname || "");

            const marker = "/file=";
            const markerPos = path.indexOf(marker);
            if (markerPos >= 0) path = path.slice(markerPos + marker.length);

            let name = path.replace(/\\/g, "/").split("/").pop() || "";
            name = name.split("?", 1)[0].split("#", 1)[0];
            if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) return name;
        } catch (_) {}

        const type = (blob && blob.type || "").toLowerCase();
        const ext = type.includes("jpeg") ? ".jpg" :
                    type.includes("webp") ? ".webp" :
                    type.includes("gif") ? ".gif" :
                    type.includes("bmp") ? ".bmp" : ".png";
        return `image${ext}`;
    }

    function flash(button, text, ok) {
        const old = button.textContent;
        button.textContent = text;
        button.dataset.oneclickState = ok ? "ok" : "error";
        window.setTimeout(() => {
            button.textContent = old;
            delete button.dataset.oneclickState;
        }, ok ? 700 : 1400);
    }

    async function copySelected(tab, button) {
        if (button.dataset.oneclickBusy === "1") return;
        const img = selectedImage(tab);
        if (!img) {
            flash(button, "!", false);
            return;
        }

        button.dataset.oneclickBusy = "1";
        button.disabled = true;

        try {
            const src = img.currentSrc || img.src;
            const sourceResponse = await fetch(src, {cache: "no-store"});
            if (!sourceResponse.ok) throw new Error(`画像取得失敗: ${sourceResponse.status}`);
            const blob = await sourceResponse.blob();
            const filename = filenameFromUrl(src, blob);

            const response = await fetch(ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": blob.type || "image/png",
                    "X-OneClick-Filename": encodeURIComponent(filename)
                },
                body: blob
            });

            let result = null;
            try { result = await response.json(); } catch (_) {}
            if (!response.ok || !result || !result.ok) {
                throw new Error(result && result.error ? result.error : `コピー失敗: ${response.status}`);
            }

            flash(button, "✓", true);
        } catch (error) {
            console.error("[One-click Copy]", error);
            flash(button, "!", false);
        } finally {
            button.disabled = false;
            delete button.dataset.oneclickBusy;
        }
    }

    function makeButton(tab, row) {
        const id = `${BUTTON_ID_PREFIX}${tab}`;
        if (appRoot().querySelector(`#${id}`)) return;

        const save = row.querySelector(`#save_${tab}`);
        const button = document.createElement("button");
        button.id = id;
        button.type = "button";
        button.textContent = "📌";
        button.title = "選択中の画像を仕分け先へ1クリックコピー";
        button.setAttribute("aria-label", button.title);

        if (save) {
            button.className = save.className;
            save.insertAdjacentElement("afterend", button);
        } else {
            button.className = "lg secondary gradio-button tool";
            row.appendChild(button);
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            copySelected(tab, button);
        });
    }

    function inject() {
        const root = appRoot();
        for (const tab of ["txt2img", "img2img"]) {
            const row = root.querySelector(`#image_buttons_${tab}`);
            if (row) makeButton(tab, row);
        }
    }

    let scheduled = false;
    function scheduleInject() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            inject();
        });
    }

    if (typeof onUiLoaded === "function") {
        onUiLoaded(() => {
            inject();
            new MutationObserver(scheduleInject).observe(appRoot(), {childList: true, subtree: true});
        });
    } else {
        window.addEventListener("load", () => {
            inject();
            new MutationObserver(scheduleInject).observe(appRoot(), {childList: true, subtree: true});
        });
    }
})();
