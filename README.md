# Forge Neo One-click Copy

Forge Neo の生成結果から、現在選択している画像を指定フォルダーへ **1クリックでコピー**する小型拡張です。

## インストール

Forge Neo の **拡張機能 → URLからインストール** に次を貼り付けます。

`https://github.com/R122-code/forge-neo-oneclick-copy.git`

インストール後、Forge Neo を再起動してください。

## 操作

txt2img / img2img の生成画像下のボタン列に **📌** が追加されます。

1. コピーしたい画像を選択
2. 📌 を1回押す
3. 指定フォルダーへ即コピー

元画像は削除・移動しません。同名ファイルがある場合は `_001`, `_002` ... を付けて上書きを避けます。

成功時はボタンが一瞬 `✓`、失敗時は `!` になります。確認ダイアログは出しません。

## 初期コピー先

Forge Neo の **txt2img画像保存フォルダー内**にある `oneclick-copy` です。

標準設定なら:

`<Forge Neo本体>\outputs\txt2img-images\oneclick-copy`

Forge Neo 側で txt2img の出力先を変更している場合は、その出力先の中に `oneclick-copy` を作ります。

旧版の `outputs\oneclick-copy` が設定値に残っている場合も、自動的に新しい初期位置へ切り替えます。

## コピー先の変更

**設定 → One-click Copy → 1クリックコピー先フォルダー**

追加Pythonパッケージは不要です。
