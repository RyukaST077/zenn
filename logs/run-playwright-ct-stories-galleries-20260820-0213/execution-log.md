# 検証ログ: Playwright 1.62 の stories & galleries でコンポーネントテストを最小構成から作り直してみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-playwright-ct-stories-galleries-20260820-0209.md`
- 出典レポート: `research/search-topic-20260820-0204.md`
- 対象技術: `@playwright/test@1.62.1`（stories & galleries モデルのコンポーネントテスト）+ Vite + React + TypeScript
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-20 02:13〜02:25 / 見積もり 約7.0h（420分） → 実測 約12分 <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 (Darwin 25.5.0, arm64) / Node v22.17.0 / npm 10.9.2 / git 2.50.1 / gh 2.95.0
- 採用した撤退ライン: 対象タスクの既定（gallery 自作に70分で mount が1つも通らなければ worked example を写す / 1.62.0 の回帰が再現しなければ「踏めなかった」と書いて終える）。**いずれも発動せず**
- 判断方針: 引数で指定されたのは対象タスクファイルのパスのみ。実行時間・撤退ライン・成果物置き場はすべてデフォルト前提を採用
- 成果物コードの置き場: `logs/run-playwright-ct-stories-galleries-20260820-0213/workspace/pw162-ct/`
  （`init-skills` は CWD の `.claude/skills/` に書き込むため、Zennリポジトリ直下では実行していない。
  `logs/**/workspace/` は `.gitignore` 済みなので、生成された `.claude/skills/` がリポジトリを汚さない）

## 結果サマリー

- 完了条件の判定: **達成（5/5）**（`--project=components` 7 tests 全 pass、gallery スクショ7枚、`update()` の state 保持を pass で確認、意図的失敗3種のエラー全文取得、1.62.0→1.62.1 の回帰ログ2本）
- 作ったもの: Vite 8 + React 19 + TS 6 の最小アプリに、自作 gallery（67行）+ story 2ファイル + spec 2ファイル + `components` プロジェクト設定。合計 **手書き 232行**
- スクショ: **7 枚**（`screenshots/`）
- 詰まった点: **6 件**（うち解決 5 / 未解決 1）
- knowledge 記録: なし（`consult-knowledge` で該当なし → 新規1件は原因確定に至らなかったため未記録。詳細は「未達・撤退」参照）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `npx playwright test --project=components` が全 pass（HTMLレポート保存） | **達成** | `commands.log` の `FINAL verification run`（`7 passed (1.6s)` / `exit=0`）、`playwright-report/index.html` 生成、`screenshots/07-html-report.png`（All 7 / Passed 7 / Failed 0） |
| 2 | gallery ページの Playwright スクショが撮れている | **達成** | `screenshots/01-gallery-index.png`（story一覧＋空の `#root`）、`02`〜`06`（各 story の mount 後） |
| 3 | `component.update({ value: 2 })` でカウンタ内部 state が保持されることをアサートしたテストが pass | **達成** | `commands.log` phase3-3g / FINAL（`update() re-renders without remounting: internal state survives` ✓）、`screenshots/06-story-counter-after-update.png`（label は `updated` に変わり count は `3` のまま） |
| 4 | 意図的な失敗のエラー全文がログに残っている | **達成**（予定の2種＋1種） | `commands.log` phase4-1b（`Unknown story: components/Button/Primary`）、phase4-2（`net::ERR_CONNECTION_REFUSED`）、phase4-x（`The gallery page does not define window.mount().`）、phase3-6b（`update()` の state リセット） |
| 5 | 1.62.0 で tsconfig 回帰を踏み、1.62.1 で直ることを同一手順のログ2本で示す | **達成**（#41989 と #41998 の2件で再現） | `commands.log` phase4-3a（1.62.1 で `7 passed`）→ phase4-3b（1.62.0 で `Failed to resolve "extends" path` / `No tests found`）→ phase4-3d（1.62.1 に戻して `7 passed`）、phase4-3e（`references` 版も同じ形で再現） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約1分）

- [x] `npm view @playwright/test dist-tags versions` で latest を確認（見積もり 10分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    npm view @playwright/test dist-tags
    npm view @playwright/test versions --json | tail -20
    npm view @playwright/experimental-ct-react dist-tags
    ```
  - 出力（全文）:
    ```
    {
      rc: '1.18.0-rc1',
      beta: '1.62.1-beta-1785366875000',
      latest: '1.62.1',
      next: '1.63.0-alpha-2026-08-19'
    }
    ```
    ```
    { beta: '1.62.1-beta-1785366875000',
      latest: '1.62.1',
      next: '1.63.0-alpha-1786107553000' }
    ```
  - 効いた対処 / 試したこと: —（プラン作成時の実測と完全一致）
  - 記事に書きたい気づき: 旧CTパッケージ `@playwright/experimental-ct-react` は **latest 1.62.1 として今も publish されていて npm 上で deprecated 扱いにもなっていない**（`npm view ... deprecated` が空）。ただし alpha の発行は `2026-08-07` で止まっている一方、`@playwright/test` の alpha は `2026-08-19` まで出ている → 実質フェードアウト中と読める。

- [x] `gh release view` で v1.62.0 / v1.62.1 の変更点と回帰3件を控える（見積もり 15分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    gh release view v1.62.1 --repo microsoft/playwright
    gh release view v1.62.0 --repo microsoft/playwright
    ```
  - 出力（v1.62.1 の Bug Fixes 全文）:
    ```
    ### Bug Fixes

    - #41989 [Regression]: tsconfig "extends" bare specifier isn't resolved via node_modules walk-up like tsc (fatal since 1.62)
    - #41998 [Regression]: directory-form tsconfig project references ("path": "../pkg") fail to resolve (fatal since 1.62)
    - #41985 Accessibility snapshot drops button name when text is nested inside spans with aria-hidden SVG
    - #42000 [Regression]: page.evaluate() arg of a branded primitive type (string & { brand }) no longer type-checks since 1.62
    - #42013 [BUG]Image-type actionable elements are not presented in the snapshot.
    ```
  - v1.62.0 側の要点（記事の2節で使う）:
    - 「Component testing moves to a **stories and galleries** model」。`fixtures.mount()` は gallery に遷移して story id で mount し、**story の root 要素にスコープした `Locator` を返す**
    - 「Pass a story type as a template argument to type-check its props, and use `update(props)` / `unmount()` on the returned locator」
    - その他: AbortSignal 対応 / WebP スクリーンショット / `Reporter.preprocess()` / `retryStrategy: 'isolated'` / `npx playwright mcp`・`npx playwright cli` の同梱
    - ⚠️ breaking: **Debian 11 サポート終了**
    - Browser Versions: Chromium 151.0.7922.34 / Firefox 153.0 / WebKit 26.5
  - 記事に書きたい気づき: 1.62.1 の Bug Fixes のうち **3件が `[Regression]` かつ「fatal since 1.62」**。CT を新規に始める人は 1.62.0 を踏む理由がないので、素直に 1.62.1 以降を指定すべき。

- [x] `https://playwright.dev/docs/test-components` を読んで4点をメモ（見積もり 15分 → 実測 <1分）
  - (a) story ファイル: コンポーネントの隣に `*.story.tsx`（`.ts`/`.jsx`/`.js`/`.vue` も可）。**named export 1つ = 1シナリオ**
  - (b) gallery が公開するもの: `window.mount({ story, props })` が story を `#root` に描画、`window.unmount()` で破棄。**未知の story / 描画エラーは reject** し、それがテスト側の `mount()` の throw になる
  - (c) story id: `src/` 以下のパスから `.story.*` 拡張子を除いたもの + export 名 → `components/Button/Primary`。**一意なら後方一致の短縮形も通る**（`Button/Primary`）
  - (d) `mount()` は `#root` の `Locator` を返す。`component.update(props)` / `component.unmount()`
  - (e) config: `baseURL` = gallery の URL、`serviceWorkers: 'block'`、`reuseContext: true`、`webServer` で dev server を起動
  - 「旧方式と何が違うか」自分の言葉で3行:
    1. 旧方式はテストファイルの中に JSX を書き、Playwright 側のバンドラがそれをブラウザへ運んでいた。新方式は **JSX がアプリ側の `*.story.tsx` に移る**。
    2. Playwright は「バンドラを持つ側」をやめ、**アプリ自身の dev server が配信する1枚のHTML（gallery）を叩くだけ**になった。
    3. その代わり **mount の実装責任がアプリ側に来る**（root を再利用するか作り直すかで `update()` の意味が変わる）。
  - 分かりにくかった用語: 「gallery」。Storybook のような閲覧UIを想像したが、実体は **`window.mount` を生やすだけの空HTML1枚**でよい（閲覧用インデックスは任意）。

- [x] `node -v` / `npm -v` / OS を記録（見積もり 5分 → 実測 <1分）
  - 実行したコマンド: `node -v; npm -v; sw_vers; uname -m`
  - 出力: `v22.17.0` / `10.9.2` / macOS 26.5 (Build 25F71) / `arm64`
  - Vite の Node 要求（20.19+ / 22.12+）を満たす。**ただし後述のとおり実際に入ったのは Vite 8 系**

### フェーズ2: 環境構築（見積もり 60分 → 実測 約2分）

- [x] `npm create vite@latest . -- --template react-ts` → `npm install` → `npm run dev`（見積もり 15分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    mkdir -p pw162-ct && cd pw162-ct
    npm create vite@latest . -- --template react-ts
    npm install
    npm run dev
    ```
  - 出力（全文）:
    ```
    npm warn exec The following package was not found and will be installed: create-vite@9.1.2
    > 024_zenn@1.0.0 npx
    > create-vite . --template react-ts
    │
    ◇  Scaffolding project in .../workspace/pw162-ct...
    │
    └  Done. Now run:

      npm install
      npm run dev
    ```
    ```
    added 27 packages, and audited 28 packages in 7s
    ```
    ```
      VITE v8.2.1  ready in 113 ms
      ➜  Local:   http://localhost:5173/
      ➜  Network: use --host to expose
    ```
    `curl -s -o /dev/null -w 'http=%{http_code}' http://localhost:5173/` → `http=200`
  - 生成されたバージョン（`npm ls --depth=0`）:
    ```
    ├── @types/node@24.13.3
    ├── @types/react-dom@19.2.4
    ├── @types/react@19.2.18
    ├── @vitejs/plugin-react@6.0.5
    ├── oxlint@1.79.0
    ├── react-dom@19.2.8
    ├── react@19.2.8
    ├── typescript@6.0.3
    └── vite@8.2.1
    ```
  - つまずいた理由・分かっていなかった前提: プランは「Vite 7 系（Node 20.19+/22.12+ 要求）」を前提にしていたが、実際に入ったのは **Vite 8.2.1 / TypeScript 6.0.3 / React 19.2.8**。さらに scaffold の lint が ESLint ではなく **oxlint** になっていた。dev server のポートは既定どおり 5173。
  - 記事に書きたい気づき: 「`npm create vite@latest` は毎回同じものが出てくる」と思っていると、記事の再現手順がすぐ古くなる。**入ったバージョンを `npm ls --depth=0` で貼るのが正解**。

- [x] `Button.tsx` / `Counter.tsx` を作る（見積もり 15分 → 実測 <1分）
  - `src/components/Button.tsx`（全文）:
    ```tsx
    export type ButtonProps = {
      title: string;
      disabled?: boolean;
      onClick?: () => void;
    };

    export function Button({ title, disabled = false, onClick }: ButtonProps) {
      return (
        <button type="button" disabled={disabled} onClick={onClick}>
          {title}
        </button>
      );
    }
    ```
  - `src/components/Counter.tsx`（全文）:
    ```tsx
    import { useState } from 'react';

    export type CounterProps = {
      /** 初期値。React の state 初期化にのみ使う（以降の変更は無視される） */
      value: number;
      label?: string;
    };

    export function Counter({ value, label = 'count' }: CounterProps) {
      const [count, setCount] = useState(value);
      return (
        <div>
          <span data-testid="label">{label}</span>
          <output data-testid="count">{count}</output>
          <button type="button" onClick={() => setCount((c) => c - 1)}>
            dec
          </button>
          <button type="button" onClick={() => setCount((c) => c + 1)}>
            inc
          </button>
        </div>
      );
    }
    ```
  - `Counter` に内部 state を持たせた理由: `value` を **`useState` の初期値にしか使わない**設計にしておくと、`update({ value: 2 })` したときに
    - gallery が root を再利用していれば → 再描画のみ。`useState` の初期値は無視され、**クリックで動かした count がそのまま残る**
    - gallery が root を作り直していれば → 再マウント。**count が新しい `value` にリセットされる**
    という形で「`update()` が本当に再描画なのか」を **1つのアサーションで判別できる**。`label` も渡しているので「props 自体は届いている（=再描画は起きた）」ことを同時に示せる。

- [x] `git init` → 初期コミット（`init-skills` 実行前）（見積もり 5分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    git init && git add -A
    git -c user.name=practice -c user.email=practice@local commit -m 'chore: vite react-ts scaffold + Button/Counter'
    ```
  - 出力: `Initialized empty Git repository in .../pw162-ct/.git/` / コミット **`7e2006e`** / `git status --porcelain` は空（clean）
  - 記事に書きたい気づき: **これは後で効かなかった**。`init-skills` の生成物は全部 untracked なので `git diff` は空のまま。差分を見るには `git status --short --untracked-files=all` を使う必要がある（後述の詰まりポイント#5）。

- [x] `npm i -D @playwright/test@1.62.1` → `npx playwright install chromium`（見積もり 10分 → 実測 約2秒）
  - 実行したコマンド:
    ```bash
    npm i -D @playwright/test@1.62.1
    npx playwright --version
    npx playwright install chromium
    ```
  - 出力（全文）:
    ```
    added 4 packages, and audited 32 packages in 986ms
    Version 1.62.1
    ```
    `npx playwright install chromium` → **出力なし / exit=0 / elapsed=0s**
  - つまずいた理由・分かっていなかった前提: プランは「初回は数百MBのDLで数分」と見積もっていたが、**このマシンには既に chromium がキャッシュ済みで完全な no-op だった**。
    ```
    $ ls ~/Library/Caches/ms-playwright
    chromium-1194 ... chromium-1234  (7世代)
    $ du -sh ~/Library/Caches/ms-playwright/chromium-*
    299M ... 356M
    ```
  - 記事に書きたい気づき: **1バージョンあたり約300〜356MBが世代ごとに残る**。7世代で 2.2GB 超。`npx playwright install --dry-run` / 古い世代の掃除は別途書ける小ネタ。所要時間の表には正直に「キャッシュ済みだったので0秒。初回は数分かかる」と書く。

- [x] `npx playwright init-skills --loop claude` を実行し、生成物を全部記録（見積もり 15分 → 実測 <1分）**← 記事の山場その1**
  - 実行したコマンド:
    ```bash
    npx playwright init-skills --help
    npx playwright init-skills --loop claude
    git status --short --untracked-files=all
    find .claude -type f | sort
    wc -l $(find .claude -type f)
    ls playwright.config.ts playwright/ src/components/*.story.tsx tests/
    ```
  - 出力（全文）:
    ```
    Usage: npx playwright init-skills [options]

    Install Playwright agent skills

    Options:
      --loop <loop>  Agentic loop provider (choices: "claude", "agents", default:
                     "claude")
      -h, --help     display help for command
    ```
    ```
    ✅ Skill installed to `.claude/skills/playwright-cli`.
    ✅ Skill installed to `.claude/skills/playwright-component-testing`.
    ✅ Skill installed to `.claude/skills/playwright-trace`.
    ```
    生成ファイル一覧（**16ファイル / 2710行、すべて Markdown**）:
    ```
    .claude/skills/playwright-cli/SKILL.md                              (420行)
    .claude/skills/playwright-cli/references/element-attributes.md       (23行)
    .claude/skills/playwright-cli/references/playwright-tests.md         (39行)
    .claude/skills/playwright-cli/references/request-mocking.md          (87行)
    .claude/skills/playwright-cli/references/running-code.md            (241行)
    .claude/skills/playwright-cli/references/session-management.md      (225行)
    .claude/skills/playwright-cli/references/storage-state.md           (275行)
    .claude/skills/playwright-cli/references/test-generation.md         (433行)
    .claude/skills/playwright-cli/references/tracing.md                 (139行)
    .claude/skills/playwright-cli/references/video-recording.md         (143行)
    .claude/skills/playwright-component-testing/SKILL.md                (143行)
    .claude/skills/playwright-component-testing/references/gallery-spec.md (144行)
    .claude/skills/playwright-component-testing/references/migration.md   (85行)
    .claude/skills/playwright-component-testing/references/react.md       (67行)
    .claude/skills/playwright-component-testing/references/vue.md         (75行)
    .claude/skills/playwright-trace/SKILL.md                            (171行)
    ```
    期待していたものの有無:
    ```
    $ ls playwright.config.ts playwright/ src/components/*.story.tsx tests/
    (eval):1: no matches found: src/components/*.story.tsx
    exit=1
    ```
  - つまずいた理由・分かっていなかった前提: **コマンド名（`init-skills`）から「足場を作ってくれる」と読んだのが間違い**。`init-skills` は
    - フレームワーク検出をしない（`--loop` 以外のオプションが存在しない）
    - `playwright.config.ts` を作らない
    - `playwright/gallery/` を作らない
    - story も spec も作らない

    実体は **Markdown 16枚を `.claude/skills/` に置くだけ**。検出も実装も「そのスキルを読んだエージェント（＝今回は自分）」の仕事。
  - 既存技術と比べて感じた違い: `npm create vite` や `npx storybook init` の "init" は**動くファイルを生成する**。`playwright init-skills` の "init" は**エージェント向けの説明書を配置する**。同じ動詞で意味が違う。
  - 記事に書きたい気づき: これは設計としては筋が通っている（gallery はアプリのコードなので**ユーザー所有**にすべき）。ただし **`init-skills` という名前と `✅ Skill installed` という成功メッセージだけを見ると「もう出来た」と誤読する**。「何も作られていない」と気づくまでの数分が新人の最初の壁。

### フェーズ3: 実装・検証【本編】（見積もり 180分 → 実測 約4分）

- [x] `gallery-spec.md` を読んで gallery を自力実装（見積もり 50分 → 実測 約1分）**← 記事の山場その2**
  - **`SKILL.md` が参照する `templates/` が同梱されていない**（詰まりポイント#2の予測が的中）:
    - `SKILL.md` の Setup workflow step 4: 「Write a first story next to an existing component, **modeled on `templates/<react|vue>/Button.story.*`**」
    - step 5: 「Write a first spec, **modeled on `templates/react/button.spec.ts`**」
    - `references/react.md`: 「Stories: `src/**/*.story.tsx` ...; **example in `templates/react/Button.story.tsx`**」
    - しかし `find .claude -type f` の出力（上記16ファイル）に **`templates/` は1つも無い**。同梱物は `SKILL.md` + `references/` の5ファイルのみ。
  - 効いた対処: `references/gallery-spec.md` の **"Worked example (React + Vite SPA)"** と `references/react.md` を代わりに読んだ。gallery-spec の worked example には
    「An illustration of the contract, **not** a file to copy — implement the equivalent for your stack」
    と明記されており、**contract（`window.mount` / `window.unmount` / `#root` / root 再利用 / 未知 story は reject）さえ守れば実装は自由**と分かった。
  - `playwright/gallery/main.tsx`（全文 / 67行 / 手書き）:
    ```tsx
    import { StrictMode } from 'react';
    import { flushSync } from 'react-dom';
    import { createRoot, type Root } from 'react-dom/client';
    import '../../src/index.css';

    type StoryModule = Record<string, unknown>;

    const stories = import.meta.glob<StoryModule>('../../src/**/*.story.{tsx,jsx}');

    /** '../../src/components/Button.story.tsx' -> 'components/Button' */
    const idOf = (file: string) =>
      file.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '');

    async function resolveStory(storyId: string) {
      const sep = storyId.lastIndexOf('/');
      const path = storyId.slice(0, sep);
      const name = storyId.slice(sep + 1);
      const file = Object.keys(stories).find(
        (f) => idOf(f) === path || idOf(f).endsWith('/' + path),
      );
      if (!file) return undefined;
      const mod = await stories[file]();
      return (mod[name] ?? mod.default) as React.ComponentType<never> | undefined;
    }

    const rootEl = document.getElementById('root')!;
    let root: Root | undefined;

    declare global {
      interface Window {
        mount: (params: { story: string; props?: Record<string, unknown> }) => Promise<void>;
        unmount: () => Promise<void>;
        storyIds: () => string[];
      }
    }

    window.mount = async ({ story, props }) => {
      const Story = await resolveStory(story);
      if (!Story) throw new Error(`Unknown story: ${story}`);
      // create the root once and reuse it, so update() reconciles instead of remounting
      root ??= createRoot(rootEl);
      // flushSync so a render error rejects this promise instead of being swallowed
      flushSync(() => {
        root!.render(
          <StrictMode>
            {/* @ts-expect-error props are resolved at runtime from the story id */}
            <Story {...props} />
          </StrictMode>,
        );
      });
    };

    window.unmount = async () => {
      root?.unmount();
      root = undefined;
    };

    // convenience for eyeballing the gallery in a browser
    window.storyIds = () => Object.keys(stories).map(idOf);

    // optional index: list the discovered story files when nothing is mounted
    const index = document.getElementById('index');
    if (index) {
      index.innerHTML = Object.keys(stories)
        .map((f) => `<li><code>${idOf(f)}</code></li>`)
        .join('');
    }
    ```
  - `playwright/gallery/index.html`（全文 / 15行）:
    ```html
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Playwright story gallery</title>
      </head>
      <body>
        <h1>Playwright story gallery</h1>
        <p>Discovered story files (call <code>window.mount({ story })</code> to render one):</p>
        <ul id="index"></ul>
        <hr />
        <div id="root"></div>
        <script type="module" src="./main.tsx"></script>
      </body>
    </html>
    ```
  - `import.meta.glob` で story を集める部分の説明: `import.meta.glob('../../src/**/*.story.{tsx,jsx}')` は **Vite がビルド時に静的解析して「パス → 動的 import 関数」のマップに展開する**。だから
    - パスは **この main.tsx から見た相対パス**でなければならない（`'../../src/...'`）
    - **変数に入れたパターンは使えない**ので、共有パッケージに切り出せない
    → gallery-spec の「`import.meta.glob` stays inline here ... That is exactly why the gallery is yours to own」の意味がここで分かった。
    id 復元は `'../../src/components/Button.story.tsx'` から `^(\.\./)+src/` と `\.story\.\w+$` を落として `components/Button` にし、
    末尾の export 名を足して `components/Button/Primary`。短縮形は `idOf(f).endsWith('/' + path)` で後方一致させている。
  - `flushSync` の役割: `root.render()` は React 18+ では非同期にスケジュールされるので、そのまま `await` すると **描画完了前に `window.mount` の Promise が解決**してしまう。
    `flushSync(() => root.render(...))` で同期的に描画を流し切ると、(1) mount 解決時点で DOM に出ている、(2) **story の描画で throw したら `window.mount` が reject する**（gallery-spec が要求する挙動）の両方を満たせる。
  - つまずいた理由: 「gallery」という語から Storybook 的な閲覧UIを想像していたが、**契約は `window.mount` / `window.unmount` / `#root` の3つだけ**。閲覧用インデックス（`<ul id="index">`）はあくまで任意のおまけ。
  - 記事に書きたい気づき: 実装した gallery は **67行**。「フレームワーク固有の糊はここだけに閉じ込める」という指示が、行数で見ると本当に小さい。ただしその67行に **`update()` の意味（root 再利用）と失敗時の reject という契約が全部乗っている**。

- [x] `playwright.config.ts` に `components` プロジェクトと `webServer` を設定（見積もり 25分 → 実測 <1分）
  - `playwright.config.ts`（全文 / 25行）:
    ```ts
    import { defineConfig, devices } from '@playwright/test';

    const GALLERY_URL = 'http://localhost:5173/playwright/gallery/index.html';

    export default defineConfig({
      reporter: [['list'], ['html', { open: 'never' }]],
      projects: [
        {
          name: 'components',
          testDir: './tests/components',
          use: {
            ...devices['Desktop Chrome'],
            // mount() が baseURL へ遷移するので、gallery の index.html まで含める
            baseURL: GALLERY_URL,
            serviceWorkers: 'block',
            reuseContext: true,
          },
        },
      ],
      webServer: {
        command: 'npm run dev',
        url: GALLERY_URL,
        reuseExistingServer: !process.env.CI,
      },
    });
    ```
  - `baseURL` を `index.html` まで含める理由（実測済み）: `mount()` は `baseURL` へ `page.goto()` する。origin だけ（`http://localhost:5173`）にすると **アプリ本体（`src/main.tsx` の App）が開いてしまい `window.mount` が存在しない**。実際のエラーは phase4-x に全文あり。
  - `serviceWorkers: 'block'` / `reuseContext: true` を自分の言葉で:
    - `serviceWorkers: 'block'`: アプリが Service Worker を登録していると、**SW のキャッシュ応答が `page.route()` のモックを追い越して**しまう。gallery はアプリの dev server 上に住むので、アプリの SW をそのまま巻き込む。だからブロックする。
    - `reuseContext: true`: worker 内でブラウザコンテキストを使い回す。**旧CTランタイムがやっていた高速化を明示オプションとして復活させたもの**。今回の実測でも7テストが1.5秒で終わる。
  - 記事に書きたい気づき: 旧CTの `ctViteConfig` / `ctPort` / `ctTemplateDir` / `ctCacheDir` が全部消えて、**普通の `webServer` + `baseURL` に一本化された**（`references/migration.md` の対応表どおり）。設定の総量は確かに減っている。

- [x] story / spec を書いて `npx playwright test --project=components` を通す（見積もり 35分 → 実測 約2分）
  - `src/components/Button.story.tsx`（全文 / 23行）:
    ```tsx
    import { useState } from 'react';
    import { Button } from './Button';

    export const Primary = () => <Button title="Submit" />;

    export const Disabled = () => <Button title="Submit" disabled />;

    export const WithTitle = ({ title = 'Default' }: { title?: string }) => (
      <Button title={title} />
    );

    /** callback は story 側で state に記録し、hidden form 経由でテストに見せる */
    export const CountsClicks = () => {
      const [clicks, setClicks] = useState(0);
      return (
        <>
          <Button title="Submit" onClick={() => setClicks((c) => c + 1)} />
          <form hidden>
            <input data-testid="clicks" readOnly value={String(clicks)} />
          </form>
        </>
      );
    };
    ```
  - `src/components/Counter.story.tsx`（全文 / 7行）:
    ```tsx
    import { Counter } from './Counter';

    export const Default = ({ value = 0, label }: { value?: number; label?: string }) => (
      <Counter value={value} label={label} />
    );

    export const Stateful = () => <Counter value={10} label="stateful" />;
    ```
  - `tests/components/button.spec.ts`（全文 / 34行）:
    ```ts
    import { test, expect } from '@playwright/test';
    import type { WithTitle } from '../../src/components/Button.story';

    test('Primary story mounts and exposes a button', async ({ mount }) => {
      const component = await mount('components/Button/Primary');
      await expect(component.getByRole('button')).toHaveText('Submit');
      await expect(component.getByRole('button')).toBeEnabled();
    });

    test('Disabled story renders a disabled button', async ({ mount }) => {
      const component = await mount('components/Button/Disabled');
      await expect(component.getByRole('button')).toBeDisabled();
    });

    test('short-form story id resolves', async ({ mount }) => {
      const component = await mount('Button/Primary');
      await expect(component.getByRole('button')).toHaveText('Submit');
    });

    test('per-test props reach the story', async ({ mount }) => {
      const component = await mount<typeof WithTitle>('components/Button/WithTitle', {
        title: 'Hello',
      });
      await expect(component.getByRole('button')).toHaveText('Hello');
    });

    test('story records callbacks into a hidden form', async ({ mount }) => {
      const component = await mount('components/Button/CountsClicks');
      await expect(component.getByTestId('clicks')).toHaveValue('0');
      await component.getByRole('button').click();
      await expect(component.getByTestId('clicks')).toHaveValue('1');
      await component.getByRole('button').click();
      await expect(component.getByTestId('clicks')).toHaveValue('2');
    });
    ```
  - `tests/components/counter.spec.ts`（全文 / 25行）:
    ```ts
    import { test, expect } from '@playwright/test';
    import type { Default } from '../../src/components/Counter.story';

    test('update() re-renders without remounting: internal state survives', async ({ mount }) => {
      const c = await mount<typeof Default>('components/Counter/Default', { value: 1 });
      await expect(c.getByTestId('count')).toHaveText('1');

      // 内部 state を動かす（1 -> 3）
      await c.getByRole('button', { name: 'inc' }).click();
      await c.getByRole('button', { name: 'inc' }).click();
      await expect(c.getByTestId('count')).toHaveText('3');

      // value は useState の初期値にしか使われないので、update() では count は変わらない。
      // ここで重要なのは「remount されていない = 内部 state が 3 のまま」という点。
      await c.update({ value: 2, label: 'updated' });
      await expect(c.getByTestId('label')).toHaveText('updated');
      await expect(c.getByTestId('count')).toHaveText('3');
    });

    test('unmount() clears the root', async ({ mount, page }) => {
      const c = await mount('components/Counter/Stateful');
      await expect(c.getByTestId('count')).toHaveText('10');
      await c.unmount();
      await expect(page.locator('#root')).toBeEmpty();
    });
    ```
  - **最初の実行は 6 pass / 1 fail**（詰まりポイント表に無い、予測外の1件）:
    ```
    Running 7 tests using 2 workers

      ✓  1 [components] › tests/components/counter.spec.ts:4:1 › update() re-renders without remounting: internal state survives (341ms)
      ✓  3 [components] › tests/components/counter.spec.ts:20:1 › unmount() clears the root (83ms)
      ✘  2 [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button (5.3s)
      ✓  4 [components] › tests/components/button.spec.ts:10:1 › Disabled story renders a disabled button (146ms)
      ✓  5 [components] › tests/components/button.spec.ts:15:1 › short-form story id resolves (74ms)
      ✓  6 [components] › tests/components/button.spec.ts:20:1 › per-test props reach the story (78ms)
      ✓  7 [components] › tests/components/button.spec.ts:27:1 › story records callbacks into a hidden form (125ms)


      1) [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button

        Error: expect(locator).toHaveText(expected) failed

        Locator: locator('#root').getByRole('button')
        Expected: "Submit"
        Timeout: 5000ms
        Error: element(s) not found

        Call log:
          - Expect "toHaveText" with timeout 5000ms
          - waiting for locator('#root').getByRole('button')
            - waiting for "http://localhost:5173/playwright/gallery/index.html" navigation to finish...
            - navigated to "http://localhost:5173/playwright/gallery/index.html"


          4 | test('Primary story mounts and exposes a button', async ({ mount }) => {
          5 |   const component = await mount('components/Button/Primary');
        > 6 |   await expect(component.getByRole('button')).toHaveText('Submit');
            |                                               ^
          7 |   await expect(component.getByRole('button')).toBeEnabled();
          8 | });

        Error Context: test-results/button-Primary-story-mounts-and-exposes-a-button-components/error-context.md

      1 failed
        [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button ─
      6 passed (8.2s)
    ```
    決定的な手がかりは **Playwright 側ではなく dev server のログ**にあった:
    ```
      VITE v8.2.1  ready in 113 ms
      ➜  Local:   http://localhost:5173/
    2:16:07 AM [vite] (client) page reload playwright/gallery/index.html
    ```
    そして `error-context.md` の accessibility snapshot は **gallery の外枠だけがあって `#root` が空**:
    ```yaml
    - heading "Playwright story gallery" [level=1]
    - paragraph:
      - text: Discovered story files (call
      - code: "window.mount({ story })"
      - text: "to render one):"
    - list:
      - listitem:
        - code: components/Button
      - listitem:
        - code: components/Counter
    - separator
    ```
    → `mount()` は成功していて、**その直後に Vite が full page reload をかけて描画を吹き飛ばしていた**。
  - 効いた対処 / 効かなかった試行（この順で試した）:
    1. `consult-knowledge` で `knowledge/` を検索 → `bash .claude/skills/consult-knowledge/scripts/search-knowledge.sh "vite" "page reload" "optimize"` → `SCORE=1/3` の無関係な1件のみ。**過去記録なし**。
    2. **仮説A: Vite の dep 事前バンドルが遅れて走り、full reload している** → `vite.config.ts` に `optimizeDeps.entries: ['index.html', 'playwright/gallery/index.html']` を追加し、`node_modules/.vite` を消して dev server 再起動 → **`7 passed`**。直ったように見えた。
    3. **対照実験（設定を戻して cold cache で再現するか）** → `optimizeDeps.entries` を消して `rm -rf node_modules/.vite` + 再起動 → **`7 passed` で再現しない**。仮説Aは棄却。
    4. **仮説B（正解）: dev server が gallery より先に起動していたから**。最初の実行では dev server を 02:14 に起動し、gallery を 02:16 に作った。**Vite の依存スキャンは起動時に走る**ので、gallery（と `react-dom` の `flushSync`）を一切見ていない。初めて gallery を開いた瞬間に新しい依存が見つかり full reload。
       決定的な再現手順:
       ```bash
       rm -rf node_modules/.vite
       mv playwright /tmp/pw_gallery_hidden   # gallery を隠す
       npm run dev                            # この状態で dev server を起動
       curl -s -o /dev/null http://localhost:5173/
       mv /tmp/pw_gallery_hidden playwright   # gallery を戻す
       npx playwright test --project=components
       ```
       → **同じ1件が同じエラーで再現**し、dev server ログに `2:18:03 AM [vite] (client) page reload playwright/gallery/index.html` が出た。
    5. **`optimizeDeps.entries` はこの条件では効かない**ことも確認（起動時に gallery のファイルが存在しないので entries に書いても無意味）: 同条件で設定ありのまま実行 → やはり1件失敗（`2:18:30 AM ... page reload playwright/gallery/index.html`）。
    6. **結論: 設定変更は不要。効いたのは「gallery を作った/直した後に dev server を作り直す」だけ**。`vite.config.ts` は scaffold の既定に戻し、最終確認で **`7 passed` / dev server ログに `page reload` 行なし**。さらに **5連続実行で 5/5 green**。
  - つまずいた理由・分かっていなかった前提: `webServer.reuseExistingServer: !process.env.CI` が **「もう上がっている dev server をそのまま使う」= 古い依存スキャン結果のサーバを使い回す**という意味だと分かっていなかった。ローカルでは便利な設定が、gallery を作った直後だけ**自分の足を撃つ**。
  - 既存技術と比べて感じた違い: 旧CTは Playwright 自身がバンドラを持っていたので、こういう「アプリの dev server の状態」に左右されなかった。**バンドラをアプリに返した代償が、dev server のライフサイクルへの依存**。
  - 記事に書きたい気づき: 「1件だけ落ちる、しかも毎回同じ1件目」は**テストのバグではなく dev server 側の full reload**を疑う。デバッグの決め手は Playwright の出力ではなく **Vite のログの `page reload` 行**だった。CI では `reuseExistingServer: false` なので毎回新しいサーバが立ち、この問題は起きない → **ローカルだけで再現する種類の不安定さ**。

- [x] Playwright で gallery ページと各 story のスクショを撮る（見積もり 20分 → 実測 <1分）
  - 実行したコマンド（`shot.mjs` を書いて実行）:
    ```js
    import { chromium } from '@playwright/test';
    const URL = 'http://localhost:5173/playwright/gallery/index.html';
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    // 以降 window.mount を直接呼ぶ（= mount fixture がやっているのと同じこと）
    await page.evaluate(() => window.mount({ story: 'components/Button/Primary' }));
    await page.screenshot({ path: '.../02-story-button-primary.png', fullPage: true });
    // ...
    ```
  - 出力:
    ```
    [console] debug [vite] connecting...
    [console] info %cDownload the React DevTools for a better development experience: ...
    [console] debug [vite] connected.
    saved 01-gallery-index.png - gallery page before any mount (story list + empty #root)
    saved 02-story-button-primary.png - Button/Primary mounted into #root
    saved 03-story-button-disabled.png - Button/Disabled mounted
    saved 04-story-button-withtitle-props.png - WithTitle with per-test props { title: "Hello" }
    saved 05-story-counter-after-clicks.png - Counter mounted with value:1, then inc x2 -> 3
    saved 06-story-counter-after-update.png - after update({value:2,label:"updated"}): label changed, count stays 3
    --- unknown story rejection (browser side) ---
    page.evaluate: Error: Unknown story: components/Button/Nope
        at window.mount (http://localhost:5173/playwright/gallery/main.tsx:23:20)
        at async <anonymous>:337:30
    ```
  - スクショ: `screenshots/01`〜`06`
  - 記事に書きたい気づき:
    - **ブラウザで gallery を直接開いて devtools から `await window.mount({ story: '...' })` を叩ける**のが素直に便利。テストを1本流すより速く「この story どう見えるんだっけ」を確認できる。`SKILL.md` の "Debugging stories" がそのまま実用。
    - 一方で自作インデックスの粗さも見えた: 自分の実装は **ファイル単位のid（`components/Button` / `components/Counter`）しか列挙していない**（`01-gallery-index.png`）。export 単位で並べるには glob を eager にして各モジュールの export 名を読む必要がある。「gallery は自分のもの＝インデックスの出来も自分の責任」の具体例。

- [x] props 付き mount と id 短縮形、型引数あり/なしの差を検証（見積もり 20分 → 実測 約1分）
  - 短縮 id: `mount('Button/Primary')` が **通った**（`short-form story id resolves` ✓）。gallery 側の `idOf(f).endsWith('/' + path)` による後方一致で解決している。
  - 型引数の効果を測るため、わざと存在しない props を渡す spec を書いた:
    ```ts
    const component = await mount<typeof WithTitle>('components/Button/WithTitle', { bogusProp: 123 });
    ```
  - **前提として重要な発見**: scaffold の `tsconfig.app.json` は `"include": ["src"]` なので、**`tests/` と `playwright/` と `playwright.config.ts` は `npm run build`（`tsc -b`）で型検査されない**。検査するには別 tsconfig を用意する必要があった:
    ```json
    {
      "extends": "./tsconfig.app.json",
      "compilerOptions": {
        "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.pw.tsbuildinfo",
        "types": ["vite/client", "node"]
      },
      "include": ["src", "tests", "playwright", "playwright.config.ts"]
    }
    ```
  - 型引数**あり**の結果（全文）:
    ```
    $ npx tsc --noEmit -p tsconfig.pw.json
    tests/components/typecheck.spec.ts(7,5): error TS2353: Object literal may only specify known properties, and 'bogusProp' does not exist in type '{ title?: string | undefined; }'.
    exit=2
    ```
  - 型引数**なし**（`mount('components/Button/WithTitle', { bogusProp: 123 })`）に書き換えた結果（全文）:
    ```
    tests/components/typecheck.spec.ts(2,1): error TS6133: 'WithTitle' is declared but its value is never read.
    exit=2
    ```
    → **残ったのは「import が未使用」だけ。`bogusProp` は素通り**。
  - 最初に `types` を絞らず実行したときの副産物エラー（全文）:
    ```
    playwright.config.ts(23,27): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
    ```
  - 記事に書きたい気づき: `mount<typeof Story>` は **props については本当に効く**。ただし
    1. 型引数を書き忘れると静かに無検査になる、
    2. **そもそも scaffold のままでは spec が型検査の対象外**（`tsc -b` は `src` だけ）
    という二段構えの穴がある。「型があるから安心」ではなく「**型検査を spec まで届かせる tsconfig を自分で足す**」のが先。

- [x] `update()` で内部 state が保持されるかを検証し、**わざと壊して比較**（見積もり 30分 → 実測 約1分）
  - 正しい実装（root 再利用）: `update() re-renders without remounting: internal state survives` **pass**。
    `value: 1` で mount → `inc` ×2 で `count=3` → `update({ value: 2, label: 'updated' })` → **label は `updated` に変わり count は `3` のまま**。
    スクショ: `screenshots/05-story-counter-after-clicks.png`（count=3）→ `screenshots/06-story-counter-after-update.png`（`updated` + `3`）
  - **わざと壊した版**（root を毎回作り直す）の差分:
    ```diff
    --- a/playwright/gallery/main.tsx
    +++ b/playwright/gallery/main.tsx
    @@ -37,8 +37,10 @@
     window.mount = async ({ story, props }) => {
       const Story = await resolveStory(story);
       if (!Story) throw new Error(`Unknown story: ${story}`);
    -  // create the root once and reuse it, so update() reconciles instead of remounting
    -  root ??= createRoot(rootEl);
    +  // BROKEN ON PURPOSE: recreate the root on every mount -> update() remounts, state is lost
    +  root?.unmount();
    +  rootEl.innerHTML = '';
    +  root = createRoot(rootEl);
       // flushSync so a render error rejects this promise instead of being swallowed
       flushSync(() => {
         root!.render(
    ```
    （`git diff` は空だった。`playwright/` は初期コミット後に作ったので untracked。比較には `diff -u /tmp/main.good.tsx playwright/gallery/main.tsx` を使った）
  - 壊した版のエラー全文（**dev server を再起動して、上記の full reload 問題と切り分けた後**の結果）:
    ```
    Running 2 tests using 1 worker

      ✘  1 [components] › tests/components/counter.spec.ts:4:1 › update() re-renders without remounting: internal state survives (5.4s)
      ✓  2 [components] › tests/components/counter.spec.ts:20:1 › unmount() clears the root (148ms)


      1) [components] › tests/components/counter.spec.ts:4:1 › update() re-renders without remounting: internal state survives

        Error: expect(locator).toHaveText(expected) failed

        Locator:  locator('#root').getByTestId('count')
        Expected: "3"
        Received: "2"
        Timeout:  5000ms

        Call log:
          - Expect "toHaveText" with timeout 5000ms
          - waiting for locator('#root').getByTestId('count')
            14 × locator resolved to <output data-testid="count">2</output>
               - unexpected value "2"


          15 |   await c.update({ value: 2, label: 'updated' });
          16 |   await expect(c.getByTestId('label')).toHaveText('updated');
        > 17 |   await expect(c.getByTestId('count')).toHaveText('3');
             |                                        ^
          18 | });

        Error Context: test-results/counter-update-re-renders--f6abb-ing-internal-state-survives-components/error-context.md

      1 failed
      1 passed (6.7s)
    ```
    **`Expected: "3" / Received: "2"`** — root を作り直したので `update()` が再マウントになり、`useState(value)` が新しい `value: 2` で再初期化された。教科書どおりの症状。
  - なお、壊した版を**dev server 再起動なしで**流した1回目は `count` の要素すら見つからず（`element(s) not found`）**別の失敗の仕方**をした。これは main.tsx を編集した HMR で gallery が full reload されたため。**同じ「壊れている」でも原因が2つ混ざるので、比較実験の前に dev server を作り直すのが必須**だった。
  - 復元して `7 passed` に戻ることも確認済み。
  - 記事に書きたい気づき: 「`update()` の挙動は gallery 実装の責任」というのは**抽象論ではなく `root ??= createRoot()` の1行**。この1行を間違えると、テストのアサーションは正しいのに落ちる。しかも落ち方が `Expected 3 / Received 2` なので、**「コンポーネントが壊れている」と誤読しやすい**。

### フェーズ4: 深掘り・比較（見積もり 90分 → 実測 約3分）

- [x] **story id は実行時文字列**であることを実測（見積もり 25分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    sed -i '' 's/^export const Primary = /export const PrimaryButton = /' src/components/Button.story.tsx
    npx tsc --noEmit -p tsconfig.pw.json
    npm run build
    npx playwright test --project=components tests/components/button.spec.ts
    ```
  - 型検査 / ビルドの結果（**両方 green**）:
    ```
    $ npx tsc --noEmit -p tsconfig.pw.json
    exit=0

    $ npm run build
    > tsc -b && vite build
    vite v8.2.1 building client environment for production...
    transforming...
    ✓ 20 modules transformed.
    rendering chunks...
    computing gzip size...
    dist/index.html                   0.45 kB │ gzip:  0.29 kB
    dist/assets/react-CHdo91hT.svg    4.12 kB │ gzip:  2.06 kB
    dist/assets/vite-BF8QNONU.svg     8.70 kB │ gzip:  1.60 kB
    dist/assets/hero-CLDdwZDr.png    13.05 kB
    dist/assets/index-D64VDMd1.css    4.10 kB │ gzip:  1.47 kB
    dist/assets/index-NFZp7ZRQ.js   193.28 kB │ gzip: 60.63 kB
    ✓ built in 380ms
    exit=0
    ```
  - テストのエラー全文:
    ```
    Running 5 tests using 1 worker

      ✘  1 [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button (376ms)
      ✓  2 [components] › tests/components/button.spec.ts:10:1 › Disabled story renders a disabled button (171ms)
      ✘  3 [components] › tests/components/button.spec.ts:15:1 › short-form story id resolves (100ms)
      ✓  4 [components] › tests/components/button.spec.ts:20:1 › per-test props reach the story (142ms)
      ✓  5 [components] › tests/components/button.spec.ts:27:1 › story records callbacks into a hidden form (126ms)


      1) [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button

        Error: page.evaluate: Error: Unknown story: components/Button/Primary
            at window.mount (http://localhost:5173/playwright/gallery/main.tsx:23:20)
            at async eval (eval at evaluate (:311:30), <anonymous>:5:7)
            at async <anonymous>:337:30
            at window.mount (http://localhost:5173/playwright/gallery/main.tsx:23:20)
            at async eval (eval at evaluate (:311:30), <anonymous>:5:7)
            at async <anonymous>:337:30
            at /.../tests/components/button.spec.ts:5:21

        Error Context: test-results/button-Primary-story-mounts-and-exposes-a-button-components/error-context.md

      2) [components] › tests/components/button.spec.ts:15:1 › short-form story id resolves ────────────

        Error: page.evaluate: Error: Unknown story: Button/Primary
            at window.mount (http://localhost:5173/playwright/gallery/main.tsx:23:20)
            at async eval (eval at evaluate (:311:30), <anonymous>:5:7)
            at async <anonymous>:337:30
            at window.mount (http://localhost:5173/playwright/gallery/main.tsx:23:20)
            at async eval (eval at evaluate (:311:30), <anonymous>:5:7)
            at async <anonymous>:337:30
            at /.../tests/components/button.spec.ts:16:21

        Error Context: test-results/button-short-form-story-id-resolves-components/error-context.md

      2 failed
      3 passed (2.5s)
    ```
  - 「コンパイルエラーにならない」制約への感想と対策案:
    - `Unknown story: <id>` は **自作 gallery の `throw new Error()` がそのまま出ている**。つまりエラーメッセージの質も自分の責任。**「近い候補」を出す実装にすれば新人の体験は大きく変わる**（例: `Unknown story: X. Available: A, B, C`）。
    - 対策案1: id をテスト側で定数化せず、**story ファイルから id を導出できるヘルパを自分で書く**。
    - 対策案2: gallery に「全 story を mount できるか」だけを見るスモークテストを1本置く。リネームすればそこが必ず落ちる。
    - 対策案3: `mount<typeof Primary>(...)` の型引数として story を import しておけば、**リネーム時に import が壊れて型エラーになる**（id 文字列自体は守れないが、気づける）。今回の `button.spec.ts` は `WithTitle` だけ import していたので `Primary` のリネームは検知できなかった。
  - 記事に書きたい気づき: **`npm run build` が通るのにテストだけ落ちる**のがこのモデルの一番の弱点。型で守られている範囲（props）と守られていない範囲（id 文字列）の境界を、最初にはっきり自覚しておく必要がある。

- [x] **dev server 依存**を実測（見積もり 15分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    # playwright.config.ts の webServer ブロックをコメントアウト
    pkill -f "node.*vite"
    curl -s -o /dev/null -w 'http=%{http_code}\n' http://localhost:5173/playwright/gallery/index.html
    npx playwright test --project=components tests/components/button.spec.ts
    ```
  - `curl` の結果: `http=000` / `exit=7`（接続できない）
  - エラー全文（5テストすべて同じ）:
    ```
    Running 5 tests using 1 worker

      ✘  1 [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button (1.3s)
      ✘  2 [components] › tests/components/button.spec.ts:10:1 › Disabled story renders a disabled button (1.1s)
      ✘  3 [components] › tests/components/button.spec.ts:15:1 › short-form story id resolves (1.1s)
      ✘  4 [components] › tests/components/button.spec.ts:20:1 › per-test props reach the story (1.1s)
      ✘  5 [components] › tests/components/button.spec.ts:27:1 › story records callbacks into a hidden form (1.1s)


      1) [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button

        Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/playwright/gallery/index.html
        Call log:
          - navigating to "http://localhost:5173/playwright/gallery/index.html", waiting until "load"


          3 |
          4 | test('Primary story mounts and exposes a button', async ({ mount }) => {
        > 5 |   const component = await mount('components/Button/Primary');
            |                           ^
          6 |   await expect(component.getByRole('button')).toHaveText('Submit');
          7 |   await expect(component.getByRole('button')).toBeEnabled();
          8 | });
            at /.../tests/components/button.spec.ts:5:27

        Error Context: test-results/button-Primary-story-mounts-and-exposes-a-button-components/error-context.md
    ```
  - 「gallery は自分の dev server 前提」だと実感した瞬間: **`page.goto` の `net::ERR_CONNECTION_REFUSED` が mount() の1行目で出る**。旧CTなら Playwright が自前でサーバを立てていたので、この失敗の形は存在しなかった。
  - CI で必要になる設定: `webServer.command`（`npm run dev`）と `webServer.url`（**gallery の URL**）は必須。`reuseExistingServer: !process.env.CI` により CI では毎回新規起動になる（結果的にフェーズ3の full reload 問題も CI では起きない）。

- [x] **`baseURL` を origin だけにする**ミスを実測（詰まりポイント#4 / 見積もり外の追加検証）
  - 実行したコマンド: `baseURL: 'http://localhost:5173'` に変更して実行
  - エラー全文（5テストすべて同じ）:
    ```
      1) [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button

        Error: page.evaluate: Error: The gallery page does not define window.mount().
            at eval (eval at evaluate (:311:30), <anonymous>:4:15)
            at UtilityScript.evaluate (<anonymous>:313:16)
            at UtilityScript.<anonymous> (<anonymous>:1:44)
            at eval (eval at evaluate (:311:30), <anonymous>:4:15)
            at UtilityScript.evaluate (<anonymous>:313:16)
            at UtilityScript.<anonymous> (<anonymous>:1:44)
            at /.../tests/components/button.spec.ts:5:21
    ```
  - 記事に書きたい気づき: **`The gallery page does not define window.mount().` は Playwright 本体が出してくれる専用メッセージ**で、非常に分かりやすい。1.62 はこのミスをちゃんと想定している。「1行の設定ミスで全部落ちる」が、メッセージを読めば5秒で直せる。

- [x] **1.62.0 の回帰を踏む**（見積もり 35分 → 実測 約1分）**完了条件5**
  - 準備: `npm i -D @tsconfig/node22`（`added 2 packages`）。`tests/tsconfig.json` を新規作成し、**プロジェクトルートの `node_modules` へ walk-up して解決される必要があるベア指定子 `extends`** を書いた:
    ```json
    {
      "extends": "@tsconfig/node22/tsconfig.json",
      "compilerOptions": {
        "types": ["node"],
        "noEmit": true
      },
      "include": ["**/*.ts"]
    }
    ```
  - **ログ1本目: 1.62.1（ベースライン）→ green**
    ```
    $ npx playwright --version
    Version 1.62.1
    $ npx playwright test --project=components
    Running 7 tests using 2 workers
      ✓ (7件すべて)
      7 passed (1.5s)
    exit=0
    ```
  - **ログ2本目: 1.62.0 に落として同じ手順 → fatal**
    ```
    $ npm i -D @playwright/test@1.62.0
    changed 3 packages, and audited 34 packages in 694ms
    $ npx playwright --version
    Version 1.62.0
    $ npx playwright test --project=components
    Error: Failed to load tsconfig file at /.../pw162-ct/tests/tsconfig.json:
    Failed to resolve "extends" path "@tsconfig/node22/tsconfig.json" referenced from /.../pw162-ct/tests/tsconfig.json
    Error: Failed to load tsconfig file at /.../pw162-ct/tests/tsconfig.json:
    Failed to resolve "extends" path "@tsconfig/node22/tsconfig.json" referenced from /.../pw162-ct/tests/tsconfig.json
    Error: No tests found

    exit=1
    ```
  - **tsconfig 自体は妥当**であることを tsc に確認させた（= 悪いのは Playwright 側のリゾルバ）:
    ```
    $ npx tsc -p tests/tsconfig.json --noEmit
    tests/components/button.spec.ts(2,32): error TS2307: Cannot find module '../../src/components/Button.story' or its corresponding type declarations.
    tests/components/counter.spec.ts(2,30): error TS2307: Cannot find module '../../src/components/Counter.story' or its corresponding type declarations.
    ```
    → `extends` については**一切文句を言わない**（出ているのは jsx 設定を継いでいないための別件）。TypeScript 6.0.3 はベア指定子を普通に解決している。
  - **ログ3本目: 1.62.1 に戻す → 同じ手順で green**
    ```
    $ npm i -D @playwright/test@1.62.1
    $ npx playwright --version
    Version 1.62.1
    $ npx playwright test --project=components
    Running 7 tests using 2 workers
      ✓ (7件すべて)
      7 passed (1.5s)
    exit=0
    ```
  - **おまけ: #41998（ディレクトリ形式の project references）も再現した**
    ```json
    // tests/tsconfig.json
    {
      "compilerOptions": { "types": ["node"], "noEmit": true },
      "references": [{ "path": "../packages/shared" }],
      "include": ["**/*.ts"]
    }
    ```
    1.62.0:
    ```
    Error: Failed to load tsconfig file at /.../pw162-ct/tests/tsconfig.json:
    Failed to resolve "references" path "../packages/shared" referenced from /.../pw162-ct/tests/tsconfig.json
    Error: Failed to load tsconfig file at /.../pw162-ct/tests/tsconfig.json:
    Failed to resolve "references" path "../packages/shared" referenced from /.../pw162-ct/tests/tsconfig.json
    Error: No tests found
    ```
    1.62.1 では通る。
  - issue #41989 の記述と実際の症状の一致: **一致**。「tsconfig "extends" bare specifier isn't resolved via node_modules walk-up like tsc (fatal since 1.62)」の通り、(a) ベア指定子で (b) walk-up が必要な位置（`tests/` から root の `node_modules` へ）のときに (c) fatal（`No tests found` で1本も実行されない）。#41998 も記述どおり。
  - つまずいた理由・分かっていなかった前提: **Vite scaffold の `tsconfig.json` は project references を「ファイル形式」（`{ "path": "./tsconfig.app.json" }`）で書いている**ので、素の状態では #41998 を踏まない。再現するには自分でディレクトリ形式に書き換える必要があった。「回帰があると聞いたのに手元で踏めない」ときは**踏む条件を作りに行く**のが正解。
  - 記事に書きたい気づき: fatal の出方が **`No tests found`（exit=1）**。「テストが0件です」というメッセージだけ見ると、`testDir` や glob の設定ミスを疑って延々と探しがち。**その上に出ている `Failed to load tsconfig file` が本命**。patch 1つ（1.62.0 → 1.62.1）で直る類のものにこれ以上時間を使わないためにも、**バージョン固定を記事に明記する**価値がある。

- [x] `@playwright/experimental-ct-react` の生存確認と旧方式との比較表（見積もり 15分 → 実測 <1分 / 任意タスク）
  - 実行したコマンド:
    ```bash
    npm view @playwright/experimental-ct-react versions --json | tail -5
    npm view @playwright/experimental-ct-react@1.62.1 dist.unpackedSize
    npm view @playwright/experimental-ct-react@1.62.1 deprecated
    ```
  - 出力:
    ```
      "1.63.0-alpha-2026-08-04",
      "1.63.0-alpha-2026-08-05",
      "1.63.0-alpha-2026-08-06",
      "1.63.0-alpha-2026-08-07"
    ]
    22976
    (deprecated は空)
    ```
    → **latest 1.62.1 で publish 継続中、npm 上で deprecated 指定なし**。ただし alpha は `2026-08-07` で止まっており、`@playwright/test` の alpha（`2026-08-19`）と比べて **12日分止まっている**。
  - 概念対応表（`references/migration.md` の表 + 今回の実装体験を突き合わせたもの）:

    | 旧 `@playwright/experimental-ct-*` | 新 gallery パターン | 今回実際に書いたもの |
    |---|---|---|
    | `mount(<Button title="…" onClick={spy} />)` | story が state と callback を持ち、hidden form に記録。テストは `toHaveValue()` で見る | `CountsClicks` story + `expect(c.getByTestId('clicks')).toHaveValue('2')` |
    | テストから plain data props | `mount(id, props)` で変わらず | `mount<typeof WithTitle>('components/Button/WithTitle', { title: 'Hello' })` |
    | テストから JSX children / slots | **不可**。構成ごとに story export を切る | `Primary` / `Disabled` を別 export にした |
    | `component.update(<Button count={2} />)` | `component.update({ count: 2 })`（root 再利用が前提） | `c.update({ value: 2, label: 'updated' })` |
    | `component.unmount()` | 同じ（gallery の `window.unmount()` が裏側） | `c.unmount()` + `#root` が空になるアサート |
    | `beforeMount` / `afterMount`（`playwright/index.ts`） | **gallery の `window.mount` の中身**、または story の decorator | `<StrictMode>` ラップを `window.mount` 内に置いた |
    | `hooksConfig` の per-test 差分 | props として渡し、story/decorator が解釈 | （今回は未使用） |
    | `playwright/index.html`（styles/fonts/theme） | gallery の `index.html` / entry の import | `import '../../src/index.css'` を main.tsx に |
    | `ctViteConfig` / `ctPort` / `ctTemplateDir` / `ctCacheDir` | **全部消滅**。アプリの dev server + `webServer` + `baseURL` | `playwright.config.ts` の25行だけ |
    | `defineConfig` from `experimental-ct-react` | `@playwright/test` の素の `defineConfig` | 同上 |

  - 「旧 `mount(<Button onClick={spy}/>)` が story + 隠しフォーム記録に置き換わる」を自分の言葉で:
    旧方式は **spy が Node 側にいて、コンポーネントはブラウザ側**という分断があり、Playwright が両者の間で値をやり取りしていた。新方式は **spy に相当するものも story の中（ブラウザ側）に置く**。callback は state を更新し、その state を `<form hidden><input data-testid="..." readOnly value={...}/></form>` として DOM に露出させる。テストは「Node に返ってきた値」ではなく「**ページに見えている値**」を `toHaveValue()` で見る。結果として、他の Playwright アサーションと同じ **web-first（自動リトライ）** の恩恵を受ける。
  - 移行コストの体感（実装はしていないので、あくまで書き味の比較としての見立て）: **機械的な find & replace では絶対に終わらない**。テスト1本ごとに「この JSX のうち何が story に行き、何が props として残るか」を人が判断する必要がある。逆に **新規で始めるなら学ぶことは少ない**（今回、契約を理解してから gallery + story + spec + config で 232行 / 実作業4分）。
  - **`references/migration.md` 自体の記述の矛盾を見つけた**（記事のネタ）: 同ファイル末尾の "Before / after" の "after" 例が、
    ```ts
    const component = await mount('components/Button/Default', { onClick: (data: string) => messages.push(data) });
    await component.click();
    ```
    となっている。しかしこれは同じスキルの他の記述と2点で矛盾する:
    1. `gallery-spec.md`・`SKILL.md` は「**props は plain serializable data に限る / callback は story の中**」と繰り返し言っている。関数は `page.evaluate()` 越しに渡せない。
    2. `SKILL.md` は「`component.getByRole('button').click()`, **not** `component.click()`」と明示している（`mount` が返すのは `#root` の Locator なので）。
    → **公式スキルの中でも「移行前後の対応表」だけが古い書き味を引きずっている**可能性がある。新人がこの例をコピーすると詰まる。

### フェーズ5: 振り返り・記事化準備（見積もり 45分 → 実測 約2分）

- [x] 見積もりと実測の差を表にする（下記「所要時間」）
- [x] スクショとログを整理し、見出しと対応づける（下記「スクリーンショット一覧」）
- [x] 「記事への写像」を実績で埋める（下記）
- [x] 最終確認: `vite build` が gallery を無視するか（`SKILL.md` の主張の検証）
  ```
  $ rm -rf dist && npm run build && find dist -name '*.html'
  ✓ built in 112ms
  dist/index.html
  ```
  → **`dist/` に gallery の html は出ない**。gallery は dev 専用で本番バンドルを汚さない。SKILL.md の主張は正しい。
- [x] 最終確認: 手書き行数の内訳
  ```
  $ wc -l playwright/gallery/* playwright.config.ts src/components/*.tsx tests/components/*.ts
        15 playwright/gallery/index.html
        67 playwright/gallery/main.tsx
        25 playwright.config.ts
        23 src/components/Button.story.tsx
        13 src/components/Button.tsx
         7 src/components/Counter.story.tsx
        23 src/components/Counter.tsx
        34 tests/components/button.spec.ts
        25 tests/components/counter.spec.ts
       232 total
  ```
  うち **CT のために増えた分は 171行**（Button.tsx 13 + Counter.tsx 23 + アプリ本体を除いた残り）。`init-skills` が生成したのは **Markdown 2710行、コード 0行**。

## 所要時間（見積もり → 実測）

| フェーズ | 見積もり | 実測 | 差 |
|---|---|---|---|
| 1. 事前調査 | 45分 | 約1分 | `npm view` / `gh release view` / docs が全部CLI・1発で済んだ |
| 2. 環境構築 | 60分 | 約2分 | chromium がキャッシュ済み（本来は数分のDL） |
| 3. 実装・検証 | 180分 | 約4分 | うち **約2分が full reload 問題の原因究明**（仮説2つ・対照実験3回） |
| 4. 深掘り・比較 | 90分 | 約3分 | 回帰再現は条件を作れば1発 |
| 5. 振り返り | 45分 | 約2分 | — |
| **合計** | **420分（7.0h）** | **約12分** | |

> 実測は AI エージェント単独・非対話の値。人が同じことをやる場合、フェーズ1のドキュメント読解とフェーズ3の gallery 契約の理解に大半の時間が行くはず。**記事に書くなら「見積もりのどこが外れたか」の質だけを使う**（chromium キャッシュで0秒 / full reload の原因究明が実装より長い、など）。

## 詰まった点と解決過程（記事の核）

実行中に実際に詰まった点。予測（詰まりポイント表）と実際の差分も併記する。

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 予測との差 | 記事での活かし方 |
|---|---|---|---|---|---|---|---|
| 1 | `init-skills` を実行しても gallery / config / story ができない | `init-skills` は Markdown 16枚を `.claude/skills/` に置くだけのコマンド。フレームワーク検出も実装もしない（オプションは `--loop` のみ） | `find .claude -type f` で生成物を確認し、`SKILL.md` の Setup workflow 1〜6 を自分で実行 | <1分 | 解決 | **予測どおり（表#1）** | 山場その1。`✅ Skill installed` という成功メッセージだけ見て「出来た」と誤読する話。公式の設計思想（gallery はアプリのコードなのでユーザー所有）まで書く |
| 2 | `SKILL.md` が指す `templates/react/Button.story.tsx` が存在しない | 同梱物は `SKILL.md` + `references/` の5ファイルのみ。`templates/` は入っていない（`find` で確認） | `references/gallery-spec.md` の "Worked example" と `references/react.md` を代わりに読む。worked example には「not a file to copy」と明記されている | <1分 | 解決 | **予測どおり（表#2）** | 山場その2。「一次情報どおりにやったのにファイルが無い」。`find` の出力を証拠として貼る |
| 3 | **7テストのうち1件だけが毎回落ちる**。`#root` が空で `element(s) not found` | dev server を **gallery を作る前に起動**していた。Vite の依存スキャンは起動時に走るので gallery（`react-dom` の `flushSync`）を見ておらず、初めて gallery を開いた瞬間に新依存を発見して **full page reload** → 直前の `mount()` の描画が消える | **gallery を作った/直した後に dev server を作り直す**だけ。`optimizeDeps.entries` の追加は**効かなかった**（起動時にファイルが無いので無意味）と対照実験で確認 | 約2分 | 解決 | **予測になかった（表に無い新種）** | 一番の目玉。決め手が Playwright の出力ではなく **Vite ログの `page reload` 行**だったこと、`reuseExistingServer: !process.env.CI` が「古いスキャン結果のサーバを使い回す」意味だったこと、**CI では起きずローカルだけで再現する**こと |
| 4 | `update()` を呼ぶと内部 state がリセットされる（`Expected: "3" / Received: "2"`） | gallery が毎回 root を作り直していると再描画ではなく再マウントになり `useState(value)` が再初期化される | `root ??= createRoot(rootEl)` で root を再利用する（1行） | <1分（意図的に壊した検証） | 解決 | **予測どおり（表#6）** | わざと壊した版と正しい版のログを並べる。「落ち方が `Expected 3 / Received 2` なのでコンポーネントのバグと誤読しやすい」 |
| 5 | `git diff` が空で、`init-skills` / 自作ファイルの差分が見えない | 生成物が全部 **untracked**。初期コミットを先に打っても `git diff` には出ない | `git status --short --untracked-files=all` と `find` を使う。ファイル比較は `diff -u` で退避コピーと取る | <1分 | 解決 | **予測になかった**（プランは「`git diff` で残す」前提だった） | 小ネタ1段落。「生成物 diff を取るために先にコミット」は untracked には効かない |
| 6 | 検証中に1回だけ `update()` テストが落ちた（`#3` とは別タイミング） | **不明**。全22回のスイート実行（7テスト単位）のうち1回。`#3` と同じ症状クラスだが再現条件が特定できなかった | 5連続実行で 5/5 green、「監視ファイルを実行中に追加」「実行直前に `npm i`」の2仮説も各3回試して**再現せず** | 約1分 | **未解決** | — | 正直に「1/22で原因不明の1件があった」と書く。`#3` の再現手順は確定しているので、そちらを本命として提示する |

### `consult-knowledge` / `save-knowledge` の実績

- `#3` に当たった時点で `consult-knowledge` を実行:
  ```bash
  bash .claude/skills/consult-knowledge/scripts/search-knowledge.sh "vite" "page reload" "optimize"
  ```
  ```
  SCORE=1/3  HITS=38  knowledge/2026-08-17-npm-edgesout-crash-installing-vitest5.md
      vite | title: "npm 10.9.2 で `npm i -D vitest@5.0.0-rc.1` が ..."
  ```
  → 語が1つ当たっただけの無関係な記録。**過去記録なし**と判断してゼロから調査した。
- `save-knowledge`: **未実施**。`#3` は再現手順まで確定しているが「Playwright CT 固有」ではなく「Vite dev server の依存スキャンのタイミング」という一般的な話であり、`#6` は原因未確定。記録するなら `#3` を「Vite dev server を作り直さないと新規 html エントリが full reload を起こす」として1本立てるのが妥当（**記事化後の申し送り**）。

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| `screenshots/01-gallery-index.png` | gallery ページ（mount 前）。自作インデックスが `components/Button` / `components/Counter` を列挙、`#root` は空 | 5. 実際に試したこと（gallery 自作） |
| `screenshots/02-story-button-primary.png` | `window.mount({ story: 'components/Button/Primary' })` 後。`#root` に `Submit` ボタンが出ている | 5. 実際に試したこと |
| `screenshots/03-story-button-disabled.png` | `Disabled` story（ボタンが灰色 = disabled） | 5. 実際に試したこと |
| `screenshots/04-story-button-withtitle-props.png` | per-test props（`{ title: 'Hello' }`）が表示に反映されている | 5. 実際に試したこと（props） |
| `screenshots/05-story-counter-after-clicks.png` | `value: 1` で mount → `inc` ×2 → count が `3` | 5. 実際に試したこと（update 前） |
| `screenshots/06-story-counter-after-update.png` | `update({ value: 2, label: 'updated' })` 後。**label は `updated` に変わり count は `3` のまま**（= 再マウントされていない） | 5 / 6 / 7（`update()` の核心。単独で貼るなら 05 と並べる） |
| `screenshots/07-html-report.png` | HTML レポート。`All 7 / Passed 7 / Failed 0 / Flaky 0`、7テストの内訳と実行時間 1.5s | 5. 実際に試したこと（pass の証拠） / 10. まとめ |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 「実行の前提」冒頭 | Playwright CT を触ったことがない立場での検証だと明示。使ったバージョン（`@playwright/test@1.62.1` / Vite 8.2.1 / React 19.2.8 / TS 6.0.3 / Node v22.17.0 / macOS 26.5 arm64）を先に置く。旧CTの実務経験がないので比較部分は公式対応表ベースだと断る |
| 2. なぜ Playwright 1.62 の CT を試すのか（何が変わったか） | フェーズ1「gh release view v1.62.0」の出力 | 「moves to a **stories and galleries** model」の引用 + 要点3行（JSX が story に移る / Playwright はバンドラを持つのをやめた / mount の実装責任がアプリに来る）。`ctViteConfig` 等が消えた事実も1行 |
| 3. 事前に調べたこと（1.62.1 固定の経緯） | フェーズ1の `npm view` / `gh release view v1.62.1` 全文 | `latest = 1.62.1` / `next = 1.63.0-alpha-2026-08-19`。1.62.1 の Bug Fixes 5件のうち**3件が `[Regression]` かつ fatal since 1.62**（#41989 / #41998 / #42000）。Debian 11 サポート終了にも触れる |
| 4. 環境構築（Vite + React + init-skills） | フェーズ2の全ログ。`find .claude -type f` の16ファイル一覧、`ls` の `no matches found`、`init-skills --help` | **山場その1**。`✅ Skill installed` 3行と「gallery も config も story も無い」を並べる。生成物は Markdown 2710行 / コード0行。`npx storybook init` との "init" の意味の違い。差分の見方が `git diff` ではなく `git status -s -uall` になった話（詰まった点#5） |
| 5. 実際に試したこと（gallery 自作 / story / props / update） | フェーズ3の全ソース（gallery 67行 / index.html 15行 / config 25行 / story 30行 / spec 59行）+ `screenshots/01`〜`07` | **山場その2**（`templates/` 不在、`find` の出力を証拠に）。`import.meta.glob` が inline でなければならない理由、`flushSync` が「描画完了で解決 / 描画エラーで reject」の両方を担う話。手書き232行という規模感。devtools から `await window.mount({story})` を叩ける便利さ |
| 6. 詰まった点 | 「詰まった点」表の6件 + 各エラー全文 | 順番は**実際に踏んだ時系列**で: ①`init-skills` 期待外れ → ②`templates/` 不在 → ③**1件だけ落ちる full reload**（仮説A棄却→仮説B確定の過程ごと。Vite ログが決め手） → ④`update()` の state リセット（`Expected 3 / Received 2`） → ⑤`baseURL` origin だけ（`The gallery page does not define window.mount().`） → ⑥dev server 停止（`net::ERR_CONNECTION_REFUSED`） → ⑦story リネーム（`Unknown story:`）→ ⑧1.62.0 回帰（`Failed to load tsconfig file` / `No tests found`）。**1/18の原因不明1件も正直に書く** |
| 7. 触ってみて分かったこと | フェーズ3〜4の「気づき」 | 「gallery を持つ＝バンドラ設定の二重管理が消える代わりに、mount の挙動（`root ??= createRoot()` の1行）とエラーメッセージの質まで自分の責任になる」。型で守られる範囲（props / `mount<typeof Story>`）と守られない範囲（id 文字列）の境界。**scaffold のままでは spec が `tsc -b` の対象外**という落とし穴 |
| 8. 既存の CT・Storybook と比べて感じたこと | フェーズ4の対応表 + `references/migration.md` | 概念対応表（JSX mount → story export、spy → 隠しフォーム記録 + `toHaveValue()` の web-first リトライ、`ctViteConfig` 等の消滅）。**`migration.md` 自身の "after" 例が `component.click()` と関数 props で他の記述と矛盾している**点も指摘（新人が最初にコピーしうる場所なので価値が高い） |
| 9. どんな人に向いていそうか | フェーズ4の移行コスト体感 + 旧パッケージの生存状況 | 新規で始める人: 学ぶ契約は3つだけ（`window.mount` / `window.unmount` / `#root`）で軽い。既存CT資産がある人: find & replace では終わらない（テスト1本ごとに story と props の切り分けが必要）。旧パッケージは latest 1.62.1 で生きていて deprecated でもないが alpha は 08-07 で止まっている → 移行は急がなくてよいが方向は明確。Storybook 併用者: story の粒度が近いので発想は流用しやすい |
| 10. まとめ | 「所要時間」表 + 「詰まった点」表 + `screenshots/07` | 新人が踏む落とし穴の順位（①`init-skills` の期待外れ ②`templates/` 不在 ③dev server 起因の1件落ち ④`baseURL` ⑤`update()` の root 再利用 ⑥id 文字列）。次に試したいこと: gallery のインデックスを export 単位にする / `toHaveScreenshot()` で VRT に繋げる / `page.route()` と `serviceWorkers: 'block'` の組み合わせ。**`@playwright/test@1.62.1` 以上を指定する**ことを結論に置く |

## 未達・撤退した項目

- **詰まった点#6（原因不明の1件）: 未解決**。フェーズ4-3e の実行で `update()` テストが1回だけ落ちた（全22回のスイート実行（7テスト単位、`commands.log` の結果行で計数）のうち1回）。
  - 試したこと: 同条件で5連続実行 → 5/5 green。仮説「実行中に監視対象ファイルが増えると full reload する」→ テスト実行の0.9秒後に `src/scratch.ts` を作成して3回試行 → 全 pass。仮説「直前の `npm i` が Vite の依存キャッシュを無効化する」→ `npm i -D @playwright/test@1.62.1` 直後に実行を3回 → 全 pass。**どちらも棄却**。
  - **記録上の反省**: このときの出力を `tail -6` で切ってログに残してしまい、**エラー全文が残っていない**（残っているのは `1 failed` / `6 passed (6.6s)` と `error-context.md` のパスのみ。その後の実行で上書きされた）。「エラーは全文で残す」を自分で破った1件。
  - 残したログ: `commands.log` の phase4-3e（L1220-1226） / 4-3f / 4-3g / 4-3h
  - 判断: 詰まった点#3 と同じ症状クラス（full reload による mount 消失）と推測できるが、再現条件を特定できなかったため**未解決として記録**。記事では「#3 の再現手順は確定、ただし同種の再現できない1件もあった」と書く。
- **`save-knowledge` の実施: 見送り**。理由は「詰まった点」節の末尾に記載。
- 撤退ラインの発動: **なし**（gallery 自作は撤退ライン70分に対して約1分、1.62.0 の回帰も再現できた）。
- プランからの逸脱: なし。テーマの置き換え・課金・サインアップ・手動デプロイは一切行っていない。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリのバージョン:
  - macOS 26.5（Darwin 25.5.0, arm64）/ Node v22.17.0 / npm 10.9.2
  - `@playwright/test@1.62.1`（**1.62.0 は避ける**）/ Chromium 151.0.7922.34（1.62 系同梱）
  - Vite 8.2.1 / `@vitejs/plugin-react` 6.0.5 / React 19.2.8 / react-dom 19.2.8 / TypeScript 6.0.3
  - `npm create vite@latest` は create-vite 9.1.2 を取得し、lint は ESLint ではなく **oxlint 1.79.0** が入る
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  mkdir pw162-ct && cd pw162-ct
  npm create vite@latest . -- --template react-ts
  npm install
  npm i -D @playwright/test@1.62.1
  npx playwright install chromium

  # ここで src/components/{Button,Counter}.tsx と *.story.tsx、
  # playwright/gallery/{index.html,main.tsx}、playwright.config.ts、tests/components/*.spec.ts を作る
  # （init-skills は .claude/skills/ に Markdown を置くだけなので、コードは自分で書く）
  npx playwright init-skills --loop claude   # 参照ドキュメントが欲しい場合のみ

  # gallery を作った「後」に dev server を上げる（重要）
  npx playwright test --project=components
  ```
- 注意点:
  - **`baseURL` は gallery の `index.html` まで含める**。origin だけだと `The gallery page does not define window.mount().` で全落ちする。`webServer.url` も同じ URL にする。
  - **gallery を新規作成／編集したら dev server を作り直す**。すでに起動している dev server は起動時の依存スキャン結果を使い回すため、初回の gallery アクセスで Vite が full page reload をかけ、直後の `mount()` が空振りして「毎回1件目だけ落ちる」。`webServer.reuseExistingServer: !process.env.CI` のせいでローカルだけで起きる。Vite ログの `page reload playwright/gallery/index.html` が目印。
  - **`update()` で state を保持したいなら gallery で root を再利用する**（`root ??= createRoot(rootEl)`）。作り直すと再マウントになる。
  - **story id は実行時の文字列**。export 名を変えても `tsc -b` / `vite build` は通り、テストだけが `Unknown story: <id>` で落ちる。
  - **Vite scaffold の `tsconfig.app.json` は `include: ["src"]`** なので、`tests/` と `playwright/` と `playwright.config.ts` は `npm run build` で型検査されない。spec の型検査を効かせるには別 tsconfig（`include` を広げ、`types` に `node` を足す）が必要。
  - `mount<typeof Story>(...)` の型引数を書かないと props は無検査（`{ bogusProp: 123 }` が素通り）。
  - `@playwright/test@1.62.0` は tsconfig 解決に fatal な回帰がある: ベア指定子 `extends`（#41989）とディレクトリ形式 `references`（#41998）。症状は `Failed to load tsconfig file` + **`No tests found`**。`testDir` の設定ミスと誤読しやすい。1.62.1 で修正済み。
  - Playwright のブラウザキャッシュは `~/Library/Caches/ms-playwright/` に**バージョン世代ごと**に残る（chromium 1世代あたり 299〜356MB）。
  - `vite build` は `playwright/gallery/index.html` を無視する（`dist/` に出ない）。gallery は dev 専用。
  - `npx playwright init-skills` は **CWD の `.claude/skills/` に書き込む**。既存プロジェクトで実行すると自分のスキルディレクトリに混ざるので、試すだけなら使い捨てディレクトリで。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/playwright-ct-stories-galleries.md` を作成する（`/draft-article`）
- [ ] スクショを `images/playwright-ct-stories-galleries/` に移し、本文から `![説明](/images/playwright-ct-stories-galleries/01-gallery-index.png)` の形で参照する
- [ ] 完了条件・詰まった点6件・比較表を本文に落とす
- [ ] 記事化時にパス（`/Users/...` を含む絶対パス）をマスクする
- [ ] `.claude/skills/` の内容は**全文転載せず**、要点の短い引用に留める（ライセンス配慮）
- [ ] 過去記事 `vitest4-browser-mode-visual-regression-log` と混ざらないよう、VRT ではなく **CT のモデル刷新**に話を絞る
