import os
import re
from pathlib import Path
from urllib.parse import unquote

from fastapi import Request
from fastapi.responses import JSONResponse

from modules import paths, script_callbacks, shared
from modules.options import OptionInfo


SETTING_KEY = "oneclick_copy_dir"
OLD_DEFAULT_DIR = str(Path(paths.script_path) / "outputs" / "oneclick-copy")
MAX_BYTES = 256 * 1024 * 1024


def _txt2img_copy_default() -> str:
    base_raw = (
        getattr(shared.opts, "outdir_samples", "")
        or getattr(shared.opts, "outdir_txt2img_samples", "")
        or str(Path(paths.script_path) / "outputs" / "txt2img-images")
    )
    base_raw = os.path.expandvars(os.path.expanduser(str(base_raw).strip()))
    base = Path(base_raw)
    if not base.is_absolute():
        base = Path(paths.script_path) / base
    return str((base / "oneclick-copy").resolve())


def _resolve_destination() -> Path:
    default_dir = _txt2img_copy_default()
    raw = getattr(shared.opts, SETTING_KEY, default_dir) or default_dir
    raw = os.path.expandvars(os.path.expanduser(str(raw).strip()))

    # v1.0 の旧初期値は自動的に txt2img 側へ移行する。
    try:
        if Path(raw).resolve() == Path(OLD_DEFAULT_DIR).resolve():
            raw = default_dir
    except Exception:
        pass

    path = Path(raw)
    if not path.is_absolute():
        path = Path(paths.script_path) / path
    return path.resolve()


def _safe_filename(raw_name: str, content_type: str) -> str:
    name = unquote(raw_name or "").replace("\\", "/").split("/")[-1]
    name = name.split("?", 1)[0].split("#", 1)[0].strip()

    name = re.sub(r'[<>:"/\\\\|?*\x00-\x1f]', "_", name)
    name = name.rstrip(" .")

    ext_by_type = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/bmp": ".bmp",
    }
    fallback_ext = ext_by_type.get((content_type or "").split(";", 1)[0].lower(), ".png")

    stem, ext = os.path.splitext(name)
    if not stem:
        stem = "image"
    if ext.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}:
        ext = fallback_ext

    if stem.upper() in {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}:
        stem = f"_{stem}"

    stem = stem[:180].rstrip(" .") or "image"
    return f"{stem}{ext}"


def _write_without_overwrite(dest_dir: Path, filename: str, data: bytes) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(filename).stem
    suffix = Path(filename).suffix

    for n in range(100000):
        candidate = dest_dir / (filename if n == 0 else f"{stem}_{n:03d}{suffix}")
        try:
            with candidate.open("xb") as f:
                f.write(data)
            return candidate
        except FileExistsError:
            continue

    raise RuntimeError("同名ファイルの連番上限に達しました。")


def on_ui_settings():
    section = ("oneclick-copy", "One-click Copy")
    shared.opts.add_option(
        SETTING_KEY,
        OptionInfo(
            _txt2img_copy_default(),
            "1クリックコピー先フォルダー",
            section=section,
        ).info("初期値は txt2img 画像フォルダー内の oneclick-copy。変更は保存後すぐ反映されます。"),
    )


def on_app_started(_demo, app):
    if any(getattr(route, "path", None) == "/oneclick-copy/copy" for route in app.routes):
        return

    @app.post("/oneclick-copy/copy")
    async def oneclick_copy(request: Request):
        try:
            data = await request.body()
            if not data:
                return JSONResponse({"ok": False, "error": "画像データが空です。"}, status_code=400)
            if len(data) > MAX_BYTES:
                return JSONResponse({"ok": False, "error": "画像データが大きすぎます。"}, status_code=413)

            content_type = request.headers.get("content-type", "image/png")
            if not content_type.lower().startswith("image/"):
                return JSONResponse({"ok": False, "error": "画像ではないデータです。"}, status_code=415)

            filename = _safe_filename(request.headers.get("x-oneclick-filename", ""), content_type)
            dest = _write_without_overwrite(_resolve_destination(), filename, data)
            return JSONResponse({"ok": True, "filename": dest.name, "path": str(dest)})
        except Exception as exc:
            print(f"[One-click Copy] copy failed: {exc}")
            return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)


script_callbacks.on_ui_settings(on_ui_settings)
script_callbacks.on_app_started(on_app_started)
