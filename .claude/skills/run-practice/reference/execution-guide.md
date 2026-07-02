# 実行ガイド（実装・検証・記録の詳細）

`run-practice` の Step 3〜Step 6 で使う。実際にコマンドを叩いて成果物を作り、ログとスクショを
残すときの実務指針。

## Executability（AIエージェント単独実行の判定）

実行中のタスク／操作を次で判定する。NG に当たったら「置換」→ 無理なら「撤退記録」。

### OK（そのまま実行してよい）

* ローカルで動くライブラリ・CLI・フレームワーク（npm / pip / cargo 等）
* トークン不要の公開API、ローカルのモデル・DB（Docker / SQLite / ローカルLLM）
* `wrangler dev` / `supabase start` などローカルで完結する範囲のクラウド系ツール
* Webアプリの表示・操作は Playwright で自動操作し、スクリーンショットで完了確認

### NG（→ 置換、無理なら撤退記録）

* 課金APIキー・クレジットカード登録が必要 → ローカルモデル／トークン不要APIに置換
* 手動サインアップ・メール/電話認証・手動OAuth → 認証不要のツール/ローカル完結に置換
* 手動デプロイ・ダッシュボードでの手動操作 → `... dev` 等のローカル起動に置換
* CAPTCHA・ログイン壁でブラウザ自動化が不可 → 該当機能をスキップし撤退記録

置換した場合は「何を何に置き換えたか・理由」を execution-log.md に必ず残す。

## Workspace Setup（作業環境の準備）

出力ディレクトリの構成は次を基本にする。

```
logs/run-<slug>-<YYYYMMDD-HHMM>/
├── execution-log.md      ← メイン成果物（記事の素材）
├── commands.log          ← 実行したコマンドと生ログ（追記していく）
├── screenshots/          ← Playwright / 画面キャプチャ
│   ├── 01-hello.png
│   └── 02-todo-added.png
└── workspace/            ← 検証で作った成果物のコード（記事に貼る抜粋の元）
```

* スラッグは対象 `practice-<slug>-*.md` から引き継ぐ。無ければ `task`。
* `workspace/`（重い生成物）は `.gitignore` の `logs/**/workspace/` で除外済み。
  記事の素材である `execution-log.md` と `screenshots/` は追跡されるので、
  リポジトリを汚さずに素材だけコミットできる。
* 事前準備チェックリストのランタイム/バージョンを最初に確認する。
  例: `node -v` / `python3 --version` / `docker --version`。想定と違えば記録する。
* 依存インストールは非対話で。例: `npm create <tpl>@latest -- --yes` /
  `npm install` / `pip install -r requirements.txt`。

## Run & Capture（実行とログ捕捉）

各タスクを実行しながら、出力を要約せず**全文で**残す。

* 開始・終了時刻を控えて実測時間を出す（例）:

  ```bash
  START=$(date +%s)
  # ... 作業 ...
  echo "elapsed: $(( $(date +%s) - START ))s"
  ```

* コマンドと出力を commands.log に残す（例）:

  ```bash
  { echo "## $(date +%H:%M) npm run dev"; npm run dev; } 2>&1 | tee -a logs/run-<...>/commands.log
  ```

* 長時間起動するサーバは Bash の `run_in_background` で起動し、ポートが上がってから
  検証する。終了時に必ず停止する。
* エラーが出たら**全文をコピー**して該当タスクの記録に貼る（先頭数行だけにしない）。
* 秘密情報（もしあれば）はマスクする。ただしこのSkillは認証不要前提なので基本的に鍵は扱わない。

## Playwright（ブラウザ表示の確認とスクショ）

ブラウザ表示が完了条件のときは Playwright で自動操作してスクショを撮る。手動確認はしない。

準備（ブラウザ表示を伴う成果物のときだけ実行する）:

```bash
npm i -D playwright        # package.json 宣言済み。未インストールなら入る
npx playwright install chromium
```

最小スクリプト例（`logs/run-<...>/workspace/` に置いて実行）:

```js
// shot.mjs
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:3000';
const out = process.argv[3] ?? 'shot.png';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
// 必要なら操作: await page.getByRole('button', { name: '追加' }).click();
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
```

```bash
node shot.mjs http://localhost:3000 ../screenshots/01-top.png
```

* 完了条件が「操作して結果が表示される」なら、操作 → スクショの順で撮り、
  スクショに期待状態が写っていることを execution-log.md で述べる。
* スクショは `screenshots/NN-<label>.png`（連番＋内容が分かる名前）で保存する。
* ヘッドレスで問題ない。フォント欠けなどで表示が崩れる場合は記録する（詰まった点の素材）。

## CLI / API の確認

ブラウザを伴わない成果物は、コマンド出力そのものが完了確認の証拠になる。

* API: `curl -s -i localhost:PORT/path` の**レスポンス全文**を記録し、期待どおりか述べる。
* CLI: 実行コマンドと標準出力/終了コードを記録する（`echo "exit=$?"`）。
* ビルド: `npm run build` などの成否と、生成物の存在（`ls dist/`）を記録する。

## 失敗時の対応と撤退ライン

1. **まず `consult-knowledge`**（CLAUDE.md ループ）。同種トラブルの記録があれば再利用する。
   手動検索: `bash .claude/skills/consult-knowledge/scripts/search-knowledge.sh "<語1>" "<語2>"`
2. 対象タスクの**詰まりポイント表**の「最初に試すこと」を実行する。
3. バージョン不一致・対話プロンプト・ポート衝突・CORS など定番原因を疑う
   （非対話フラグ、`--port` 変更、`--host` 指定 等）。
4. 解決したら、効いた対処・原因・所要時間を記録。**新規トラブルは `save-knowledge`** で残す。
5. **撤退ライン**（既定: 1タスクで30分以上進まない、または人手/課金が必須と判明）に達したら、
   状況・エラー全文・試したことを記録して**スキップ or 等価手段へ切替**し、次へ進む。
   成功のふり・手順の捏造は禁止。未達は未達として正直に書く。

## 記録の粒度（各タスクで最低限残すもの）

`plan-practice` の記録テンプレに対応。実行しながらこれを埋める。

* 実行したコマンド（コピペできる形）
* 出たエラーの**全文**（要約しない）
* 効いた対処 / 試したこと
* 所要時間（見積もり → 実測）
* つまずいた理由・分かっていなかった前提
* 既存技術と比べて感じた違い
* スクショのファイル名（screenshots/NN-*.png）と、それが示すもの
* 「記事に書きたい」と思った気づき

## やってはいけないこと

* エラーの全文を残さず要約で済ませる。
* 完了条件を確認せず「動いた」と書く／未達を成功に見せる。
* ブラウザ表示をスクショなしで「確認済み」と書く。
* トラブル時に `knowledge/` を見ずゼロから調べ、解決も記録しない。
* 課金・人手サインアップ・手動デプロイに手を出す。
* 担当範囲（素材収集）を越えて articles/ に記事本文を書く。
