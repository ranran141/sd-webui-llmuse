# sd-webui-llmuse

LM Studio のローカル LLM を使って、日本語入力から Stable Diffusion 用英語プロンプトを生成する SD WebUI Forge Neo 拡張機能です

## 機能

- 日本語でイメージを入力するだけで Stable Diffusion 用の英語プロンプトを生成
- Simple / Normal / Detail の 3 段階プリセットで生成の詳細度を調整
- プリセットのシステムプロンプトを自由に編集・追加・削除可能
- 使用するモデルをドロップダウンで切り替え

## インストール方法

**LM Studio のセットアップ**

1. [https://lmstudio.ai/](https://lmstudio.ai/) からインストーラーをダウンロードしてインストール
2. **Discover** タブでモデルを検索し、**Instruct** モデルをダウンロード

   ※ 必ず Instruct モデルを使用してください。Base モデルではシステムプロンプトに従いません。
   ※ 開発・検証は 16GB VRAM 環境で `Qwen3-8B-Instruct` を使用しています。VRAM が少ない場合は `Qwen3-4B-Instruct`（12GB）などの軽量モデルが候補ですが、動作は未検証です。
   ※ NSFW 用途の場合は検索キーワードに `Heretic` や `abliterated` を加えると、検閲解除済みのモデルが見つかります。

3. **Developer** タブで **Start Server** をクリックしてサーバーを起動

**LLMuse のインストール**

1. WebUI を起動
2. **Extensions** タブ → **Install from URL** を開く
3. 以下のURLを貼り付けて Install をクリック：
   ```
   https://github.com/ranran141/sd-webui-llmuse
   ```
4. WebUI を再起動

## 動作環境

- Stable Diffusion WebUI Forge Neo

## 使い方

txt2img タブのプロンプト欄の下に **「✦ LLMuse」** アコーディオンが表示されます。

1. ドロップダウンから**プリセットを選択**（Simple / Normal / Detail）
   - **Simple** — 入力を忠実に翻訳するだけ、追加要素なし
   - **Normal** — 翻訳 + 照明・雰囲気・画質タグを自然に補完（60〜80 語程度）
   - **Detail** — キャラクター詳細・ポーズ・背景・画風まで全展開（100 語以上）
2. 左のテキストボックスに**日本語で入力**
3. **Run LLM** をクリック → 右側に生成された英語プロンプトが表示される
4. **Send** をクリックして Forge Neo のプロンプト欄に追記

### 設定（⚙ ボタン）

| 項目 | 説明 |
|------|------|
| LM Studio URL | サーバーアドレス（デフォルト: `http://localhost:1234`） |
| Randomness | 出力のランダム性。低いほど忠実、高いほど多様（0.1〜2.0） |
| Auto-send | 生成後に自動でプロンプト欄へ送信する |
| Auto-unload | 使用後 n 秒でモデルを VRAM から解放する |
| Timeout | n 秒以内に応答がなければ中断する |
| Force Unload | 全モデルを今すぐ VRAM から解放する |

### プリセットエディタ（📋 ボタン）

- ドロップダウンからプリセットを選択して読み込む
- テキストエリアでシステムプロンプトを編集
- **＋** ボタンで新規プリセットを作成
- **ゴミ箱アイコン**でプリセットを削除（最後の 1 件は削除不可）
- **💾 Save** で保存

## 更新履歴

### v1.0.0

- 初回リリース
