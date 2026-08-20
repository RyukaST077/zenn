# 実践タスク: Playwright 1.62 の stories & galleries でコンポーネントテストを最小構成から作り直してみた

## このタスクの前提

- 出典レポート: `research/search-topic-20260820-0204.md`
- 元テーマ: 候補表 #1 / 「最初に試すべき1本」= **Playwright 1.62 の stories & galleries でコンポーネントテストを最小構成から作り直してみた**（引数はレポートパスのみ指定、テーマ未指定のため推奨1本を採用）
- 対象技術: `@playwright/test@1.62.1`（コンポーネントテスト = stories & galleries モデル）+ Vite + React + TypeScript
- 記事の方向性（記事タイプ）: 「試してみた」＋「移行して詰まった点」の検証ログ
- 想定筆者 / 想定読者: Web系の新人エンジニア（Playwright CT の実務経験なし） / 新人〜実務2年目のフロント担当
- 検証に使える想定時間: **1日（約6時間30分）**（引数未指定 → デフォルト「半日〜1日」の上限側を採用）
- 判断方針: 引数で上書きされた前提は「対象レポートのパス」のみ。他はデフォルト前提を採用
- 実行環境の担保: すべて **ローカル・完全無料・認証不要**。npm install / Vite dev server（localhost:5173）/ `npx playwright test` / Playwright スクリーンショットのみで完結する。課金APIキー・サインアップ・手動デプロイ・手動UI操作は一切不要。テーマの置き換えは行っていない

### このプラン作成時に一次情報で裏取りした事実（重要）

`npm view` と実際のインストール（`/tmp` の空プロジェクト）で確認済み。**出典レポートの想定と違っていた点があるので、タスクはこちらの実測に合わせてある。**

| # | 確認したこと | 実測結果 | 出典 |
|---|---|---|---|
| 1 | `@playwright/test` の最新版 | `latest = 1.62.1`（`next = 1.63.0-alpha-2026-08-19`）。**1.62.1 を固定して使う** | `npm view @playwright/test dist-tags` |
| 2 | 1.62.1 の内容 | 回帰3件（#41989 tsconfig `extends` のベア指定子が node_modules walk-up で解決されない / #41998 ディレクトリ形式の project references が解決されない / #42000 branded primitive 型の `page.evaluate()` 引数が型検査を通らない、いずれも **1.62 で fatal**）+ バグ修正2件 | `gh release view v1.62.1 --repo microsoft/playwright` |
| 3 | `npx playwright init-skills` の正体 | **gallery や config や story は生成されない。** 実体は「エージェント用スキルのインストール」。`--loop <claude\|agents>`（既定 `claude`）のみのオプションで、**非対話で完走する（stdin なしで EXIT=0）**。`.claude/skills/` 配下に `playwright-cli` / `playwright-component-testing` / `playwright-trace` の3スキルを書き込む | `npx playwright init-skills --loop claude </dev/null` |
| 4 | 生成される CT スキルの中身 | `SKILL.md` + `references/{gallery-spec,migration,react,vue}.md` の5ファイル。gallery は**自分で実装する**（「there is no template to copy for it」と明記） | 実物を `find` で確認 |
| 5 | **スキルの記述と同梱物の不一致** | `SKILL.md` は `templates/react/Button.story.tsx` / `templates/react/button.spec.ts` を「modeled on」と参照するが、**`templates/` ディレクトリは同梱されていない**（`references` と `SKILL.md` のみ） | 同上（→ 詰まりポイント表 #2） |
| 6 | 旧 CT パッケージの生存 | `@playwright/experimental-ct-react` は `latest = 1.62.1` として今も publish されている（フェーズ4の比較に使える） | `npm view @playwright/experimental-ct-react dist-tags` |
| 7 | ローカルの前提ランタイム | `node v22.17.0` / `npm 10.9.2`（Vite 7 系の要求 Node 20.19+/22.12+ を満たす。**実行時に `node -v` を再取得して記録すること**） | `node -v` / `npm -v` |

> レポートの「`init-skills` がフレームワーク/バンドラを検出して gallery と設定と初期 story/spec まで生成する」は不正確。正しくは「**スキルを置くところまでが `init-skills`。検出と実装はスキルを読んだエージェント（＝今回は自分）がやる**」。この差自体が記事の主題になるので、フェーズ2で必ず生成物を `find` と `git diff` で残す。

## 完成イメージ（成果物）

- 作るもの:
  - Vite + React + TS の最小アプリ（`Button` と `Counter` の2コンポーネント）
  - `playwright/gallery/index.html` + `playwright/gallery/main.tsx`（`window.mount` / `window.unmount` を公開する自作 gallery）
  - `src/components/Button.story.tsx`（`Primary` / `Disabled` / `WithTitle`）と `src/components/Counter.story.tsx`（`Default` / `Stateful`）
  - `tests/components/*.spec.ts`（mount / props / `update()` / 状態記録アサーション）
  - 失敗ケースのログ集（存在しない story id / dev server 停止 / 1.62.0 の tsconfig 回帰）
- 「できた」と言える完了条件:
  1. `npx playwright test --project=components` が **全 pass**（HTML レポートを保存）
  2. Playwright で `http://localhost:5173/playwright/gallery/index.html` を開いた **gallery のスクリーンショット**が撮れている
  3. `component.update({ value: 2 })` で**カウンタ内部 state が保持される**ことをアサートしたテストが pass
  4. 意図的な失敗（存在しない story id / dev server 停止）の**エラー全文**がログに残っている
  5. `@playwright/test@1.62.0` に落として tsconfig 回帰（#41989 相当）を踏み、1.62.1 に戻すと直ることが**同一手順のログ2本**で示せている
- 完了確認の方法:
  - CLI 出力（`npx playwright test` の pass/fail サマリ、`find` / `git diff` の生成物差分）
  - Playwright スクリーンショット（gallery ページ、各 story の mount 後、HTML レポート画面）
- 記事タイトル案（そのまま使える形）:
  1. Playwright 1.62 のコンポーネントテストが別物になっていたので、最小構成で作り直してみた
  2. `npx playwright init-skills` は gallery を作ってくれなかった — Playwright 1.62 の CT を自力で組んだ記録
  3. `*.story.tsx` と gallery って何？ Playwright の新コンポーネントテストを新人が初めて書いてみた

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**（Playwright / Vite / npm レジストリのみ。課金・サインアップ・トークンは一切使わない）
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js（`node -v` を記録。Vite 7 系は Node 20.19+ / 22.12+ 要求）、npm、git、`gh`（リリースノート取得用・任意）
- [ ] インストールするもの: `vite`（`npm create vite@latest`）、`@playwright/test@1.62.1`（**版固定**）、`npx playwright install chromium`（初回はブラウザDLで数分・数百MB）
- [ ] 無料枠 / コストの確認: すべて OSS・ローカル実行のため**コスト0**。ネットワークは npm と Playwright ブラウザのダウンロードのみ
- [ ] 記録用の準備:
  - 作業ディレクトリは **リポジトリ外の使い捨てディレクトリ**（例 `/tmp/pw162-ct/`）に作る。`init-skills` は **CWD の `.claude/skills/` に書き込む**ので、この Zenn リポジトリ直下では絶対に実行しない（既存プロジェクトスキルを汚す）
  - 作業ディレクトリで `git init` → **`init-skills` の前に初期コミット**（生成物 diff を取るため必須）
  - ログ: `logs/`（コマンドと出力を全文）、スクショ: `images/playwright-ct-stories-galleries/`
- [ ] 撮ったスクショ・ログの最終置き場（記事用）をこのリポジトリ側に決めておく

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 45分）

- [ ] `npm view @playwright/test dist-tags versions` で `latest` を確認し、**1.62.1 に固定する理由**（1.62.0 の回帰3件）を控える（目安: 10分）
  - 記録すること: 実行コマンドと出力全文 / 実行日時点の `latest` / `next` / このプランの表と一致したか
- [ ] `gh release view v1.62.0 --repo microsoft/playwright` と `v1.62.1` を取得し、CT 変更点と回帰3件の issue 番号を控える（目安: 15分）
  - 記録すること: 回帰3件の番号と一文要約 / 「1.62.0 を避ける」判断の根拠 / Debian 11 サポート終了などの breaking change
- [ ] `https://playwright.dev/docs/test-components` を読み、(a) story ファイル形式 (b) gallery が公開する `window.mount` / `window.unmount` (c) story id の作られ方 (d) `mount()` が `Locator` を返すこと、の4点をメモする（目安: 15分）
  - 記録すること: 「旧方式（テスト内で JSX を mount）と何が違うか」を自分の言葉で3行 / 分かりにくかった用語
- [ ] `node -v` / `npm -v` / OS を記録し、Vite の Node 要求を満たすか確認する（目安: 5分）
  - 記録すること: 再現性のための環境情報一式

### フェーズ2: 環境構築（目安: 60分）

- [ ] 使い捨てディレクトリ（例 `/tmp/pw162-ct`）に `npm create vite@latest . -- --template react-ts` で最小アプリを作り、`npm install` → `npm run dev` で起動を確認する（目安: 15分）
  - 記録すること: 実行コマンド全文 / 生成された Vite・React のバージョン（`package.json` を貼る）/ dev server のポート（既定 5173 か）
- [ ] `src/components/Button.tsx`（`title` / `disabled` props）と `src/components/Counter.tsx`（`value` を初期値に持つ内部 state + 増減ボタン）を作る（目安: 15分）
  - 記録すること: 2コンポーネントの全ソース（記事にそのまま貼る）/ `Counter` に内部 state を持たせた理由（後の `update()` 検証用）
- [ ] `git init` → `git add -A` → 初期コミット（**`init-skills` 実行前に必ず**）（目安: 5分）
  - 記録すること: コミットハッシュ / 「diff を取るために先にコミットした」意図
- [ ] `npm i -D @playwright/test@1.62.1` → `npx playwright install chromium` を実行する（目安: 10分）
  - 記録すること: インストール所要時間 / ブラウザDLのサイズと待ち時間 / `npx playwright --version` の出力
- [ ] `npx playwright init-skills --loop claude` を実行し、**何が生成されたか**を `git status` / `find .claude -type f` / `git diff --stat` で全部記録する（目安: 15分）
  - 記録すること: 出力全文（`✅ Skill installed to ...` の3行）/ 生成ファイル一覧 / **「gallery も config も story も生成されない」という期待とのズレ**（記事の山場その1）/ `--help` の出力（オプションが `--loop` だけであること）

### フェーズ3: 実装・検証【本編】（目安: 180分）

- [ ] `.claude/skills/playwright-component-testing/references/gallery-spec.md` の worked example を読み、`playwright/gallery/index.html` と `playwright/gallery/main.tsx` を自力で実装する。要件は「story id を解決」「`#root` に描画」「**root を再利用**」「未知の story / 描画失敗で reject」（目安: 50分）
  - 記録すること: gallery の全ソース / `import.meta.glob` で story を集める部分の説明 / `flushSync` など「mount の Promise を描画完了後に解決させる」ための工夫 / **`SKILL.md` が参照する `templates/` が同梱されていなかった**こと（記事の山場その2）/ 詰まった時間
- [ ] `playwright.config.ts` に `components` プロジェクト（`baseURL` = gallery の URL、`serviceWorkers: 'block'`、`reuseContext: true`）と `webServer`（`command: 'npm run dev'`、`url` = 同じ gallery URL、`reuseExistingServer: !process.env.CI`）を設定する（目安: 25分）
  - 記録すること: config 全文 / `baseURL` を gallery の `index.html` まで含めた URL にする理由（`mount` が `baseURL` に遷移する）/ `serviceWorkers: 'block'` と `reuseContext: true` の役割を自分の言葉で
- [ ] `src/components/Button.story.tsx` に `Primary` / `Disabled` / `WithTitle`（props を受ける形）を書き、`tests/components/button.spec.ts` で `mount('components/Button/Primary')` → `component.getByRole('button')` を操作・アサートする。`npx playwright test --project=components` を通す（目安: 35分）
  - 記録すること: story と spec の全文 / 最初の実行結果（失敗したらエラー全文と直した内容）/ 「`component.click()` ではなく `component.getByRole(...)` から辿る」で引っかかったか / pass 時の CLI 出力
- [ ] Playwright で gallery ページ（`http://localhost:5173/playwright/gallery/index.html`）を開いてスクリーンショットを撮る。加えて各 story の mount 後スクショも撮る（目安: 20分）
  - 記録すること: スクショのパス（gallery 一覧 / Button Primary / Disabled / Counter）/ ブラウザで gallery を直接開けることの便利さ
- [ ] props 付き mount を検証する: `mount<typeof WithTitle>('Button/WithTitle', { title: 'Hello' })` が表示に反映されること、**id の短縮形（`Button/Primary`）でも解決されること**を確認する（目安: 20分）
  - 記録すること: 型引数を付けた場合/付けない場合の型チェックの差（わざと存在しない props を渡して型エラーを出し、そのメッセージ全文を残す）/ 短縮 id が通ったか
- [ ] `Counter` で `const c = await mount('components/Counter/Default', { value: 1 })` → ボタンで内部 state を動かす → `await c.update({ value: 2 })` を実行し、**内部 state が保持されるか**をアサートする（目安: 30分）
  - 記録すること: テスト全文と結果 / gallery が root を作り直す実装に変えたら state がリセットされるか（**わざと壊して比較**し、両方のログを残す）/ 「`update()` の挙動は gallery 実装の責任」という気づき

### フェーズ4: 深掘り・比較（目安: 90分）

- [ ] **story id は実行時文字列**であることを実測する: story の export 名を `Primary` → `PrimaryButton` にリネームし、`tsc --noEmit`（または `npm run build`）が通ってしまうこと・テストだけが落ちることを確認する（目安: 25分）
  - 記録すること: 型チェックの結果（通る）/ `mount()` が投げるエラー全文 / 「コンパイルエラーにならない」制約への感想と対策案
- [ ] **dev server 依存**を実測する: `webServer` 設定をコメントアウトし dev server も止めた状態でテストを流し、どう落ちるかを記録する（目安: 15分）
  - 記録すること: エラー全文 / 「gallery は自分の dev server 前提」だと実感した瞬間 / CI で必要になる設定
- [ ] **1.62.0 の回帰を踏む**: `npm i -D @playwright/test@1.62.0` に落とし、`tsconfig.json` に node_modules 経由のベア指定子 `extends`（例: `@tsconfig/node22/tsconfig.json` を devDependency で入れて指定）を足してテストを実行 → fatal になるか確認。その後 1.62.1 に戻して同じ手順が通ることを確認する（目安: 35分）
  - 記録すること: 両バージョンのコマンドとエラー全文 / issue #41989 の記述と実際の症状が一致したか（一致しなければ**それも事実として書く**）/ 「patch を1つ飛ばすと詰む」実例としての価値
- [ ] （余力があれば）`@playwright/experimental-ct-react@1.62.1` が今も publish されている事実を確認し、旧方式の書き味との差を**表**にまとめる（実装はしない。`references/migration.md` の概念対応表と自分の実装体験を突き合わせる）（目安: 15分）
  - 記録すること: `npm view` の出力 / 「旧 `mount(<Button onClick={spy}/>)` が story + 隠しフォーム記録に置き換わる」ことを自分の言葉で / 移行コストの体感

### フェーズ5: 振り返り・記事化準備（目安: 45分）

- [ ] 記録テンプレを見返して詰まった点を棚卸しし、見積もり時間と実測時間の差を表にする（目安: 15分）
- [ ] スクショとログを記事用ディレクトリ（`images/playwright-ct-stories-galleries/` / `logs/`）に整理し、ファイル名を見出しと対応づける（目安: 15分）
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋め、素材が足りない見出しがないか点検する（目安: 15分）

> 目安時間の合計: **約6時間30分**（45 + 60 + 180 + 90 + 45 = 420分 = 7時間、うちフェーズ4末尾の任意タスク15分を除くと6時間45分）。1日の想定内。時間が足りない場合は**フェーズ4の旧CT比較 → 1.62.0 回帰 → dev server 依存**の順に削り、フェーズ3は削らない。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `init-skills` を実行しても gallery / config / story ができない | `init-skills` は**スキルを置くだけ**のコマンド。検出と実装はスキルを読む側の仕事。「足場が生成される」と思い込むとここで固まる | `find .claude -type f` で生成物を確認し、`SKILL.md` の「Setup workflow」を1〜6の手順として自分で実行する | 山場その1。「コマンド名から期待したこと」と「実際に起きたこと」を並べて書く。公式の設計思想（gallery はアプリのコードなのでユーザー所有）まで書けると強い |
| 2 | `SKILL.md` が指す `templates/react/Button.story.tsx` が見つからない | 同梱物は `SKILL.md` + `references/` の5ファイルのみで、`templates/` は入っていない（実測） | `references/gallery-spec.md` の "Worked example" と `references/react.md` を代わりに読む | 山場その2。「一次情報どおりにやったのにファイルが無い」は新人が最も不安になる場面。`find` の出力を証拠として貼る |
| 3 | テストが全部 `net::ERR_CONNECTION_REFUSED` / タイムアウトで落ちる | gallery は**自分の dev server** が配信する前提。dev server 未起動＝ページが無い | `webServer.command: 'npm run dev'` と `url` を設定する。手で `npm run dev` して gallery URL をブラウザで開けるか先に確認 | フェーズ4で意図的に再現してエラー全文を載せる。「旧 CT は Playwright 側がバンドラを持っていた」との対比 |
| 4 | `baseURL` を `http://localhost:5173` にしてしまい mount が失敗する | `mount` は `baseURL` へ遷移する仕様なので、**gallery の `index.html` まで含めた URL** でないとアプリ本体を開いてしまう | `baseURL` を `.../playwright/gallery/index.html` にする。`webServer.url` も同じにする | 「1行の設定ミスで全落ちする」典型例。落ちたときのメッセージを載せる |
| 5 | story の export をリネームしたらテストだけが落ちる | story id は実行時に解決される**ただの文字列**。型システムの守備範囲外 | `mount<typeof Story>` を使って props だけは型検査させる。id はテスト側で定数化する | フェーズ4の主題。「型があるのに守られない範囲」の実例として新人に刺さる |
| 6 | `update()` を呼んでも内部 state がリセットされる | gallery が毎回 root を作り直していると再描画ではなく再マウントになる。**root 再利用は gallery 実装の責任** | 初回に root を作って以降は同じ root に描画する実装に直す | わざと壊した版と正しい版のログを並べる。「フレームワークの reconcile に乗る」話に接続できる |
| 7 | `@playwright/test@1.62.0` で tsconfig 関連が fatal になる | 1.62 で入った tsconfig 解決の回帰（#41989 / #41998）。1.62.1 で修正済み | まず `npm i -D @playwright/test@1.62.1` に上げる。それでも出るなら `extends` / `references` の書き方を file 形式に変える | 「patch 1つで詰む/直る」実例。バージョン固定を明記する説得材料 |
| 8 | Playwright ブラウザのダウンロードが長い・失敗する | 初回は数百MBのDL。ネットワークやキャッシュ次第 | `npx playwright install chromium` だけに絞る（全ブラウザは入れない）。失敗したら再実行 | 「事前準備でここに時間を取られた」を所要時間表に正直に書く |
| 9 | この Zenn リポジトリ直下で `init-skills` を実行してしまう | CWD の `.claude/skills/` に書き込む仕様。既存のプロジェクトスキルと混ざる | 必ず使い捨てディレクトリで作業する。誤爆したら `git status` で差分を確認して破棄 | 「エージェント向けコマンドは CWD を汚す」という注意喚起として1段落 |
| 10 | Vite が起動しない / Node バージョンで警告 | Vite 7 系は Node 20.19+ / 22.12+ を要求 | `node -v` を確認。足りなければ Node を上げるか Vite の版を下げる | 再現性セクションで環境を明記する根拠 |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド: （コピペできる形で。バージョン指定込み）
- 出たエラー（全文）: （要約しない。スタックトレースまで）
- 効いた解決方法 / 試したこと: （効かなかった試行も残す）
- 所要時間（見積もり → 実測）: （タスクごとに）
- つまずいた理由・分かっていなかった前提: （「gallery は自分で書くものだと知らなかった」など）
- 既存技術と比べて感じた違い: （旧 CT / Storybook / 通常の e2e テストとの比較）
- スクショを撮った箇所: （gallery 一覧 / 各 story / HTML レポート / 失敗時のターミナル）
- 記事に書きたい気づき: （思った瞬間に1行で）

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」（10節）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機（このプランの冒頭） | Playwright CT を触ったことがない新人が 1.62 の刷新を試す、という立場表明。使ったバージョンを先に明記 |
| 2. なぜ Playwright 1.62 の CT を試すのか（何が変わったか） | フェーズ1のリリースノート調査 | stories & galleries モデルの要点3行 + 「find & replace では移行できない」規模だという事実 |
| 3. 事前に調べたこと（公式 docs / リリースノート / 1.62.1 推奨の経緯） | フェーズ1の全記録 | `npm view` の出力、回帰3件の issue 番号、なぜ 1.62.1 固定なのか |
| 4. 環境構築（Vite + React + init-skills） | フェーズ2の全記録 | 生成物の `find` / `git diff`。**`init-skills` が実際には何をするか**（詰まりポイント#1）をここで明かす |
| 5. 実際に試したこと（gallery 自作 / story 追加 / props / update） | フェーズ3の全記録 | gallery・story・spec の全ソースと pass ログ、gallery のスクショ。`templates/` 不在（#2）もここ |
| 6. 詰まった点 | 詰まりポイント表 + 記録テンプレのエラー全文 | baseURL ミス（#4）、dev server 依存（#3）、`update()` の state リセット（#6）、story id リネーム（#5）、1.62.0 回帰（#7）をエラー全文付きで |
| 7. 触ってみて分かったこと | フェーズ3〜4の「気づき」 | 「gallery を持つ＝バンドラ設定の二重管理が消える代わりに、mount の挙動まで自分の責任になる」 |
| 8. 既存の CT・Storybook と比べて感じたこと | フェーズ4の旧CT比較タスク + `references/migration.md` | 概念対応表（JSX mount → story export、spy → 隠しフォーム記録、`ctViteConfig` 等の消滅） |
| 9. どんな人に向いていそうか | フェーズ5の棚卸し | 既存 CT 資産がある人 / これから始める人 / Storybook 併用者、それぞれへの一言 |
| 10. まとめ | フェーズ5の時間表 | 所要時間（見積もり vs 実測）、新人が最初に踏む落とし穴の順位、次に試したいこと |

## 経験談として書くときのコツ

- 「Playwright CT は今回が初めて」「旧方式の実務経験はない」を冒頭で明示し、比較部分は公式ドキュメントの対応表に基づく理解だと断る
- `init-skills` への期待外れ・`templates/` 不在・`update()` のリセットは、**恥ずかしがらずに時系列で**書く（読者が同じ順で踏む）
- 実行ログ・エラー全文・スクショ・全ソースを貼る。要約したエラーは価値が落ちる
- 公式リンク（test-components / v1.62.0 / v1.62.1）を必ず入れる
- `@playwright/test@1.62.1`・Vite/React の版・Node 版・OS を明記する（1.62 系は patch 差で挙動が変わる実例を自分で踏むので説得力がある）
- 過去記事 `vitest4-browser-mode-visual-regression-log` と混ざらないよう、**VRT ではなく CT のモデル刷新**に話を絞る

## 参考リンク

- 公式ドキュメント: https://playwright.dev/docs/test-components
- リリースノート: https://github.com/microsoft/playwright/releases/tag/v1.62.0 / https://github.com/microsoft/playwright/releases/tag/v1.62.1
- スキル一覧（`init-skills` が入れるもの）: https://playwright.dev/agent-cli/skills
- ローカルの一次情報（実行後に生成される）: `.claude/skills/playwright-component-testing/{SKILL.md,references/gallery-spec.md,references/migration.md,references/react.md}`
- 1.62.1 の修正 issue: microsoft/playwright#41989 / #41998 / #42000 / #41985 / #42013

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: **なし**。OSS のみ、ローカル実行のみ。課金トリガーは存在しない
- ライセンス / 規約: Playwright / Vite / React はいずれも MIT 系。生成された `.claude/skills/` の内容を記事に**全文転載しない**（引用は要点の短い抜粋に留める）
- セキュリティ（APIキーの扱い等）: 使用するシークレットなし。ただし作業ディレクトリのパスやユーザー名がログ・スクショに写るので、記事化時にマスクする
- 作業場所: `init-skills` は **CWD の `.claude/skills/` を書き換える**。この Zenn リポジトリ直下では実行しない（使い捨てディレクトリで作業する）
- 撤退ライン:
  - gallery の自作に **70分**かけても `mount` が1つも通らない → `references/gallery-spec.md` の worked example をほぼそのまま写して先に pass させ、理解は後回しにする
  - それでも通らない → 「gallery 自作が新人には重い」という結論込みの**失敗検証ログ**として記事化する（フェーズ2の生成物 diff + 詰まった全経緯で1本成立する）
  - 1.62.0 の回帰が再現しない → 無理に再現させず「手元では踏めなかった」と事実を書いてフェーズ4を終える

## 次のアクション

- [ ] 使い捨て作業ディレクトリを決めて `git init` + 初期コミット（`init-skills` 前に必須）
- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める（エラーは全文、時間は見積もりと実測の両方）
- [ ] 完了条件5つを満たしたら「記事への写像」に沿って本文ドラフトへ展開する（`/run-practice` → `/draft-article`）
