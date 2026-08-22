---
title: "Playwright 1.62 の stories & galleries でコンポーネントテストを最小構成から作ってみた"
emoji: "🎭"
type: "tech"
topics: ["playwright", "react", "vite", "typescript", "testing"]
published: true
---

<!-- 前提: 出典ログ logs/run-playwright-ct-stories-galleries-20260820-0213/execution-log.md / 記事タイプ 検証ログ・試してみた / slug playwright162-ct-stories-galleries / published: false -->

## はじめに

Playwright 1.62 のリリースノートに「Component testing moves to a stories and galleries model」という項目があって、気になったので手元で一から組んでみました。

自分は Playwright のコンポーネントテスト（以下 CT）を触るのは今回が初めてです。旧方式の `@playwright/experimental-ct-react` を実務で使ったことはないので、「旧方式との比較」にあたる部分は公式の移行ドキュメントを読んだ上での見立てになります。そこは断って進めます。

やったのは、Vite + React + TypeScript の最小アプリに

- story ファイル（`*.story.tsx`）
- gallery（`window.mount` を生やす dev 用ページ）
- `playwright.config.ts` の `components` プロジェクト
- spec

を自分で書いて、`npx playwright test --project=components` を通すところまで。最終的に7テスト全部 pass しましたが、そこに至る途中で「1件だけ毎回落ちる」に一番時間を使いました。その原因が Playwright ではなく Vite の dev server 側だった、という話がこの記事の中心です。

:::message
筆者は CT 初挑戦の立場で、手元の Mac で一通り試した記録です。実行環境は macOS 26.5 (arm64) / Node v22.17.0 / npm 10.9.2。
:::

## 使ったもの・環境

再現できるように、実際に入ったバージョンを貼っておきます。

| 種別 | バージョン |
|---|---|
| OS | macOS 26.5（Darwin 25.5.0, arm64） |
| Node / npm | v22.17.0 / 10.9.2 |
| Playwright | `@playwright/test@1.62.1`（1.62.0 は後述の理由で避けた） |
| ブラウザ | Chromium 151.0.7922.34（1.62 系同梱） |
| ビルド周り | Vite 8.2.1 / `@vitejs/plugin-react` 6.0.5 |
| フレームワーク | React 19.2.8 / react-dom 19.2.8 / TypeScript 6.0.3 |

「できたと言える条件」は自分の中でこう決めました。

1. `npx playwright test --project=components` が全 pass し、HTML レポートが残る
2. gallery ページと各 story のスクリーンショットが撮れる
3. `update()` で内部 state が保たれることをテストで確認できる
4. 意図的に壊したときのエラー全文を取れる
5. 1.62.0 の回帰を実際に踏んで、1.62.1 で直るのを確認する

結果は5つとも取れました。

## 何が変わったのか（1.62.0 のリリースノート）

まず `gh release view` で 1.62.0 の内容を見ました。

```bash
gh release view v1.62.0 --repo microsoft/playwright
```

要点はこのあたりです。

- Component testing が stories and galleries モデルに移った。`fixtures.mount()` は gallery に遷移して story id で mount し、**story の root 要素にスコープした `Locator` を返す**
- story の型をテンプレート引数として渡すと props が型検査され、返ってきた locator に `update(props)` / `unmount()` が使える
- 他に AbortSignal 対応 / WebP スクリーンショット / `Reporter.preprocess()` / `retryStrategy: 'isolated'` / `npx playwright mcp`・`npx playwright cli` の同梱
- breaking change として Debian 11 のサポート終了

公式ドキュメント（[Components | Playwright](https://playwright.dev/docs/test-components)）を読んで、自分の言葉で3行にまとめるとこうなりました。

1. 旧方式はテストファイルの中に JSX を書き、Playwright 側のバンドラがそれをブラウザへ運んでいた。新方式では JSX がアプリ側の `*.story.tsx` に移る。
2. Playwright は「バンドラを持つ側」をやめて、アプリ自身の dev server が配信する1枚の HTML（gallery）を叩くだけになった。
3. その代わり mount の実装責任がアプリ側に来る。root を再利用するか作り直すかで `update()` の意味が変わる。

用語で一番つまずいたのは「gallery」でした。Storybook のような閲覧 UI を想像していたのですが、実体は `window.mount` を生やすだけの空 HTML 1枚で足ります。閲覧用のインデックスは付けても付けなくてもいい、あくまでおまけです。

旧方式にあった `ctViteConfig` / `ctPort` / `ctTemplateDir` / `ctCacheDir` は消えて、普通の `webServer` + `baseURL` に一本化されています。

## バージョンを 1.62.1 に固定した理由

`npm view @playwright/test dist-tags` で今の配信状況を見たところ、

```
{
  rc: '1.18.0-rc1',
  beta: '1.62.1-beta-1785366875000',
  latest: '1.62.1',
  next: '1.63.0-alpha-2026-08-19'
}
```

で、latest は 1.62.1 でした。1.62.1 の Bug Fixes を見ると内容が結構重い。

```
### Bug Fixes

- #41989 [Regression]: tsconfig "extends" bare specifier isn't resolved via node_modules walk-up like tsc (fatal since 1.62)
- #41998 [Regression]: directory-form tsconfig project references ("path": "../pkg") fail to resolve (fatal since 1.62)
- #41985 Accessibility snapshot drops button name when text is nested inside spans with aria-hidden SVG
- #42000 [Regression]: page.evaluate() arg of a branded primitive type (string & { brand }) no longer type-checks since 1.62
- #42013 [BUG]Image-type actionable elements are not presented in the snapshot.
```

5件のうち3件が `[Regression]` で、しかも「fatal since 1.62」。これから CT を始める人が 1.62.0 を選ぶ理由はないので、素直に 1.62.1 以降を指定するのが良さそうです。実際に 1.62.0 を踏んでみた記録は後半に書きます。

## 環境構築と、`init-skills` で勘違いしたこと

まず scaffold から。

```bash
mkdir -p pw162-ct && cd pw162-ct
npm create vite@latest . -- --template react-ts
npm install
npm run dev
```

dev server は既定どおり 5173 で上がりました。

```
  VITE v8.2.1  ready in 113 ms
  ➜  Local:   http://localhost:5173/
```

入ったバージョンは事前の想定と違っていました。Vite 7 系だと思っていたら Vite 8.2.1、TypeScript も 6.0.3、lint は ESLint ではなく oxlint。

```
$ npm ls --depth=0
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

`npm create vite@latest` は毎回同じものが出てくると思い込んでいたので、ここは反省点です。記事や手順書を書くなら `npm ls --depth=0` の出力をそのまま貼るのが正解だと思いました。

Playwright を入れます。

```bash
npm i -D @playwright/test@1.62.1
npx playwright --version   # Version 1.62.1
npx playwright install chromium
```

`install chromium` は出力なし・0秒で終わりました。このマシンには既にキャッシュがあったからで、初回は数百 MB のダウンロードで数分かかるはずです。ついでにキャッシュを覗いたら、世代ごとに残っていて7世代で 2.2GB 超でした（chromium 1世代あたり 299〜356MB）。

```
$ ls ~/Library/Caches/ms-playwright
chromium-1194 ... chromium-1234  (7世代)
```

そして今回一番の勘違いがここです。`npx playwright init-skills` というコマンドがあるのを見つけて、「足場（config や gallery）を作ってくれるやつだ」と思って実行しました。

```bash
npx playwright init-skills --loop claude
```

```
✅ Skill installed to `.claude/skills/playwright-cli`.
✅ Skill installed to `.claude/skills/playwright-component-testing`.
✅ Skill installed to `.claude/skills/playwright-trace`.
```

`✅` が3つ並んだので出来たと思って、生成物を探しに行ったら何もない。

```
$ ls playwright.config.ts playwright/ src/components/*.story.tsx tests/
(eval):1: no matches found: src/components/*.story.tsx
exit=1
```

生成されていたのは `.claude/skills/` 配下の Markdown 16ファイル（合計 2710行）だけでした。コードは0行。

```
.claude/skills/playwright-cli/SKILL.md                                 (420行)
.claude/skills/playwright-cli/references/element-attributes.md           (23行)
.claude/skills/playwright-cli/references/playwright-tests.md             (39行)
.claude/skills/playwright-cli/references/request-mocking.md              (87行)
.claude/skills/playwright-cli/references/running-code.md                (241行)
.claude/skills/playwright-cli/references/session-management.md          (225行)
.claude/skills/playwright-cli/references/storage-state.md               (275行)
.claude/skills/playwright-cli/references/test-generation.md             (433行)
.claude/skills/playwright-cli/references/tracing.md                     (139行)
.claude/skills/playwright-cli/references/video-recording.md             (143行)
.claude/skills/playwright-component-testing/SKILL.md                    (143行)
.claude/skills/playwright-component-testing/references/gallery-spec.md  (144行)
.claude/skills/playwright-component-testing/references/migration.md      (85行)
.claude/skills/playwright-component-testing/references/react.md          (67行)
.claude/skills/playwright-component-testing/references/vue.md            (75行)
.claude/skills/playwright-trace/SKILL.md                                (171行)
```

`--help` を見てもオプションは `--loop` だけで、フレームワークの検出すらしません。

```
Usage: npx playwright init-skills [options]

Install Playwright agent skills

Options:
  --loop <loop>  Agentic loop provider (choices: "claude", "agents", default:
                 "claude")
  -h, --help     display help for command
```

つまり `init-skills` は「エージェント向けの説明書を配置するコマンド」で、`npm create vite` や `npx storybook init` の "init"（動くファイルを作る）とは意味が違いました。設計としては筋が通っていると思います。gallery はアプリのコードなので、Playwright が勝手に生成して所有するものではない、ということでしょう。ただコマンド名と `✅ Skill installed` だけを見ていると「もう出来た」と読んでしまう。ここに気づくまでの数分が最初の壁でした。

なお、`npx playwright init-skills` は CWD の `.claude/skills/` に書き込みます。既存プロジェクトで軽く試すつもりなら、使い捨てディレクトリでやったほうが安全です。

生成物の差分を見ようとして、事前に初期コミットを打っておいたのですが、これは役に立ちませんでした。生成物は全部 untracked なので `git diff` は空のまま。`git status --short --untracked-files=all` を使う必要がありました。

## gallery を自分で書く

`.claude/skills/playwright-component-testing/SKILL.md` の Setup workflow に沿って進めようとして、もう一つ引っかかりました。step 4 に「Write a first story next to an existing component, modeled on `templates/<react|vue>/Button.story.*`」と書いてあるのですが、その `templates/` が同梱されていないんです。`references/react.md` にも「example in `templates/react/Button.story.tsx`」とあります。でも `find .claude -type f` の結果（上の16ファイル）に `templates/` は1つもありません。

代わりに読んだのが `references/gallery-spec.md` の "Worked example (React + Vite SPA)" と `references/react.md` でした。worked example には

> An illustration of the contract, not a file to copy — implement the equivalent for your stack

と明記されていて、守るべきものは実装ではなく契約だと分かりました。契約は要するに3つです。

- `window.mount({ story, props })` が story を `#root` に描画する
- `window.unmount()` で破棄する
- 未知の story や描画エラーは reject する（それがテスト側の `mount()` の throw になる）

これを踏まえて書いた gallery が67行です。

```tsx:playwright/gallery/main.tsx
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

HTML 側は15行です。

```html:playwright/gallery/index.html
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

書きながら分かったことが2つありました。

1つは `import.meta.glob` がこのファイルに inline でしか書けないこと。Vite がビルド時に静的解析して「パス → 動的 import 関数」のマップに展開するので、パスは main.tsx からの相対パス（`'../../src/...'`）でなければならず、変数に入れたパターンは使えません。だから共有パッケージに切り出せない。gallery-spec に「`import.meta.glob` stays inline here ... That is exactly why the gallery is yours to own」と書いてある意味が、ここで腑に落ちました。

もう1つは `flushSync` の役割です。`root.render()` は React 18 以降スケジュールされるだけなので、そのまま `await` すると描画完了前に `window.mount` の Promise が解決してしまう。`flushSync(() => root.render(...))` で同期的に流し切ると、mount 解決時点で DOM に出ていることと、story の描画で throw したら `window.mount` が reject することの両方を満たせます。

story id の復元は、`'../../src/components/Button.story.tsx'` から `^(\.\./)+src/` と `\.story\.\w+$` を落として `components/Button` にして、そこに export 名を足して `components/Button/Primary`。公式ドキュメントに「一意なら後方一致の短縮形も通る」とあったので、`idOf(f).endsWith('/' + path)` で `Button/Primary` にも当てています。

## config と story と spec

config は25行で済みました。

```ts:playwright.config.ts
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

`baseURL` を `index.html` まで含めているのは実測の結果です。origin だけ（`http://localhost:5173`）にすると、`mount()` の `page.goto()` でアプリ本体が開いてしまいます。そのときのエラーは後半に貼ります。

`serviceWorkers: 'block'` は、gallery がアプリの dev server 上に住む構造上、アプリが Service Worker を登録していると SW のキャッシュ応答が `page.route()` のモックを追い越してしまうためです。`reuseContext: true` は worker 内でブラウザコンテキストを使い回すオプションで、旧 CT ランタイムがやっていた高速化が明示オプションとして戻ってきたもの、という理解でいます。実際7テストが1.5秒台で終わっていました。

コンポーネントは Button と Counter の2つ。Button は props をそのまま流すだけの素朴なものです。

```tsx:src/components/Button.tsx
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

Counter は `value` を `useState` の初期値にしか使わない設計にしました。

```tsx:src/components/Counter.tsx
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

こうしておくと、`update({ value: 2 })` したときに

- gallery が root を再利用していれば再描画だけなので、クリックで動かした count がそのまま残る
- gallery が root を作り直していれば再マウントになり、count が新しい `value` にリセットされる

という形で、「`update()` が本当に再描画なのか」を1つのアサーションで判別できます。`label` も一緒に渡しているので、props 自体は届いている（＝再描画は起きた）ことも同時に見られます。

story はこうなりました。

```tsx:src/components/Button.story.tsx
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

Counter 側の story は2つだけです。

```tsx:src/components/Counter.story.tsx
import { Counter } from './Counter';

export const Default = ({ value = 0, label }: { value?: number; label?: string }) => (
  <Counter value={value} label={label} />
);

export const Stateful = () => <Counter value={10} label="stateful" />;
```

spec 側。props は `mount(id, props)` で渡し、型引数に story の型を渡します。

```ts:tests/components/button.spec.ts
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

```ts:tests/components/counter.spec.ts
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

手書きしたコードの合計はこれだけでした。

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

gallery ページをブラウザで直接開いて、devtools から `await window.mount({ story: 'components/Button/Primary' })` を叩けるのは素直に便利でした。テストを1本流すより速く「この story どう見えるんだっけ」を確認できます（今回はスクショ用スクリプトから `page.evaluate` で同じことをやりました）。

![mount 前の gallery ページ。story ファイルの一覧と空の #root だけがある](/images/playwright162-ct-stories-galleries/01-gallery-index.png)

![components/Button/Primary を mount した状態。#root に Submit ボタンが出ている](/images/playwright162-ct-stories-galleries/02-story-button-primary.png)

![Disabled story。ボタンが disabled になっている](/images/playwright162-ct-stories-galleries/03-story-button-disabled.png)

![WithTitle に props { title: "Hello" } を渡した表示](/images/playwright162-ct-stories-galleries/04-story-button-withtitle-props.png)

このスクリーンショットを撮っていて、自作インデックスの粗さにも気づきました。自分の実装はファイル単位の id（`components/Button` / `components/Counter`）しか列挙していません。export 単位で並べるには glob を eager にして各モジュールの export 名を読む必要があります。gallery が自分のものということは、インデックスの出来も自分の責任だということですね。

## 1件だけ毎回落ちる

最初にスイートを流したとき、7テスト中1件だけ落ちました。しかも毎回同じ1件（`button.spec.ts:4:1` の Primary）です。

:::details 最初の実行結果（エラー全文）
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
:::

`element(s) not found` で `#root` が空。`error-context.md` の accessibility snapshot を見ると、gallery の外枠（見出しと story 一覧）だけがあって `#root` の中身がありません。

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

決定的な手がかりは Playwright 側ではなく dev server のログにありました。

```
  VITE v8.2.1  ready in 113 ms
  ➜  Local:   http://localhost:5173/
2:16:07 AM [vite] (client) page reload playwright/gallery/index.html
```

`mount()` は成功していて、その直後に Vite が full page reload をかけて描画を吹き飛ばしていたわけです。

最初に立てた仮説は「Vite の依存事前バンドルが遅れて走って full reload している」。`vite.config.ts` に `optimizeDeps.entries: ['index.html', 'playwright/gallery/index.html']` を足して `node_modules/.vite` を消して dev server を再起動したら `7 passed` になりました。直った、と思ったのですが、念のため設定を戻して cold cache で再現するか試したら、こちらも `7 passed`。つまり効いたのは設定ではなく再起動でした。

そこから当てた2つ目の仮説が正解でした。最初の実行では dev server を 02:14 に起動して、gallery を 02:16 に作っていたんです。Vite の依存スキャンは起動時に走るので、そのサーバは gallery（と `react-dom` の `flushSync`）を一度も見ていない。初めて gallery を開いた瞬間に新しい依存が見つかって full reload になる。

条件を作れば確実に再現しました。

```bash
rm -rf node_modules/.vite
mv playwright /tmp/pw_gallery_hidden   # gallery を隠す
npm run dev                            # この状態で dev server を起動
curl -s -o /dev/null http://localhost:5173/
mv /tmp/pw_gallery_hidden playwright   # gallery を戻す
npx playwright test --project=components
```

同じ1件が同じエラーで落ちて、dev server ログにも `page reload playwright/gallery/index.html` が出ます。この条件では `optimizeDeps.entries` を書いても意味がありません（起動時に gallery のファイルが存在しないので）。実際、設定を入れたまま同条件で流してもやはり1件落ちました。

結局、効いたのは「gallery を作った／直した後に dev server を作り直す」だけでした。`vite.config.ts` は scaffold の既定に戻して、最終確認では `7 passed` かつ dev server ログに `page reload` 行なし。5連続で流しても 5/5 green でした。

自分が分かっていなかったのは `webServer.reuseExistingServer: !process.env.CI` の意味です。「もう上がっている dev server をそのまま使う」＝「古い依存スキャン結果のサーバを使い回す」でもある。ローカルでは便利な設定が、gallery を作った直後だけ自分の足を撃ちます。CI では毎回新しいサーバが立つので、これはローカルでしか再現しない類の不安定さです。

旧方式は Playwright 自身がバンドラを持っていたので、こういう「アプリの dev server の状態」に左右されることはなかったはずです。バンドラをアプリに返した代償が dev server のライフサイクルへの依存、という感じでしょうか。「1件だけ落ちる」を見たら、テストのアサーションより先に Vite のログの `page reload` 行を見るのが早いです。

正直に書いておくと、この件と別に、原因が特定できなかった失敗も1回ありました。検証中の全22回のスイート実行のうち1回だけ `update()` のテストが落ちています。同条件で5連続実行して 5/5 green、「実行中に監視対象ファイルが増えると full reload する」「直前の `npm i` が依存キャッシュを無効化する」という2つの仮説も各3回試して再現せず。上と同じ症状クラスだろうとは思っているものの、再現手順を作れなかったので未解決のままです。しかもこのときの出力を `tail` で切ってしまって、エラー全文を残せていません。「エラーは全文で残す」を自分で破りました。

## `update()` の挙動は gallery 実装の責任

`update()` の1本は素直に pass しました。`value: 1` で mount して `inc` を2回押して count を 3 にし、`update({ value: 2, label: 'updated' })` すると label だけ変わって count は 3 のまま。

![inc を2回押して count が 3 になった状態](/images/playwright162-ct-stories-galleries/05-story-counter-after-clicks.png)

![update({ value: 2, label: "updated" }) 後。label は updated に変わり、count は 3 のまま](/images/playwright162-ct-stories-galleries/06-story-counter-after-update.png)

これが gallery 実装のどこで決まっているのか確かめたくて、わざと root を毎回作り直す版に書き換えてみました。

```diff
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

:::details 壊した版のエラー全文
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
:::

`Expected: "3" / Received: "2"` になりました。root を作り直したので `update()` が再マウントになり、`useState(value)` が新しい `value: 2` で再初期化された、という教科書どおりの症状です。

怖いのは落ち方だと思いました。エラーだけ見ると「Counter コンポーネントのバグ」に見えるんですが、実際に壊れているのは gallery の `root ??= createRoot(rootEl)` の1行です。「`update()` の挙動は gallery の責任」というのは抽象論ではなく、この1行の話でした。

もう1つ余談。壊した版を dev server を再起動せずに流した1回目は、count の要素すら見つからず `element(s) not found` という別の失敗の仕方をしました。main.tsx を編集した HMR で gallery が full reload されたためです。同じ「壊れている」でも原因が2つ混ざるので、比較実験の前に dev server を作り直すのは必須でした。

## 型で守られる範囲と、守られない範囲

`mount<typeof Story>(...)` の型引数がどこまで効くのか気になって、存在しない props をわざと渡してみました。

```ts
const component = await mount<typeof WithTitle>('components/Button/WithTitle', { bogusProp: 123 });
```

ここで先に分かったのは、Vite scaffold の `tsconfig.app.json` は `"include": ["src"]` なので、`tests/` と `playwright/` と `playwright.config.ts` は `npm run build`（`tsc -b`）で型検査されていないということでした。検査するには別 tsconfig が必要でした。

```json:tsconfig.pw.json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.pw.tsbuildinfo",
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "playwright", "playwright.config.ts"]
}
```

これで型引数ありなら、ちゃんと落ちます。

```
$ npx tsc --noEmit -p tsconfig.pw.json
tests/components/typecheck.spec.ts(7,5): error TS2353: Object literal may only specify known properties, and 'bogusProp' does not exist in type '{ title?: string | undefined; }'.
exit=2
```

型引数を外して `mount('components/Button/WithTitle', { bogusProp: 123 })` にすると、残るのは「import が未使用」だけになりました。`bogusProp` は素通りです。

```
tests/components/typecheck.spec.ts(2,1): error TS6133: 'WithTitle' is declared but its value is never read.
exit=2
```

props については本当に効くけれど、型引数を書き忘れると静かに無検査になる。そして、そもそも scaffold のままでは spec が型検査の対象外。「型があるから安心」ではなく、型検査を spec まで届かせる tsconfig を自分で足すのが先だと分かりました。

もう一段弱いのが story id です。export 名を変えてみました。

```bash
sed -i '' 's/^export const Primary = /export const PrimaryButton = /' src/components/Button.story.tsx
npx tsc --noEmit -p tsconfig.pw.json   # exit=0
npm run build                          # ✓ built in 380ms / exit=0
npx playwright test --project=components tests/components/button.spec.ts
```

型検査もビルドも通ります。落ちるのはテストだけ。

```
  1) [components] › tests/components/button.spec.ts:4:1 › Primary story mounts and exposes a button

    Error: page.evaluate: Error: Unknown story: components/Button/Primary
        at window.mount (http://localhost:5173/playwright/gallery/main.tsx:23:20)
        ...

  2) [components] › tests/components/button.spec.ts:15:1 › short-form story id resolves ────────────

    Error: page.evaluate: Error: Unknown story: Button/Primary
        at window.mount (http://localhost:5173/playwright/gallery/main.tsx:23:20)
        ...

  2 failed
  3 passed (2.5s)
```

この `Unknown story: <id>` は自作 gallery の `throw new Error()` がそのまま出ているだけです。つまりエラーメッセージの質も自分の責任で、「近い候補を出す」実装にすれば体験は変わるはず（`Unknown story: X. Available: A, B, C` のように）。他に思いついた対策としては、gallery に「全 story を mount できるか」だけ見るスモークテストを1本置く、`mount<typeof Primary>(...)` の型引数として story を import しておいてリネーム時に import が壊れるのを検知する、あたりでしょうか。今回の `button.spec.ts` は `WithTitle` しか import していなかったので、`Primary` のリネームには気づけませんでした。

`npm run build` が通るのにテストだけ落ちるのは、このモデルの弱いところだと思います。型で守られている範囲（props）と守られていない範囲（id 文字列）の境界は、最初に自覚しておいたほうがいいです。

## 設定ミスの失敗の形

ついでに、やりがちなミスを2つ意図的に踏んでみました。

dev server を止めた状態（`webServer` をコメントアウト）で流すと、`mount()` の1行目で接続拒否になります。

```
    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/playwright/gallery/index.html
    Call log:
      - navigating to "http://localhost:5173/playwright/gallery/index.html", waiting until "load"


      4 | test('Primary story mounts and exposes a button', async ({ mount }) => {
    > 5 |   const component = await mount('components/Button/Primary');
        |                           ^
```

旧方式なら Playwright が自前でサーバを立てていたので、この失敗の形自体が存在しなかったはずです。「gallery は自分の dev server 前提」というのがここで実感できました。

`baseURL` を origin だけにした場合はこうなります。

```
    Error: page.evaluate: Error: The gallery page does not define window.mount().
        at eval (eval at evaluate (:311:30), <anonymous>:4:15)
        at UtilityScript.evaluate (<anonymous>:313:16)
```

これは Playwright 本体が出してくれる専用メッセージで、分かりやすくて助かりました。1行の設定ミスで全部落ちますが、メッセージを読めば数秒で直せます。1.62 はこのミスをちゃんと想定しているんだなと思いました。

## 1.62.0 の回帰を踏んでみる

冒頭に書いた 1.62.1 の Bug Fixes のうち、#41989（tsconfig の `extends` にベア指定子）を実際に踏んでみました。`@tsconfig/node22` を入れて、`tests/tsconfig.json` にベア指定子の `extends` を書きます。ルートの `node_modules` へ walk-up して解決される位置にあるのがポイントです。

```json:tests/tsconfig.json
{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

1.62.1 ではこの状態でも `7 passed (1.5s)` で通ります。1.62.0 に落とすと、

```
$ npm i -D @playwright/test@1.62.0
$ npx playwright --version
Version 1.62.0
$ npx playwright test --project=components
Error: Failed to load tsconfig file at .../pw162-ct/tests/tsconfig.json:
Failed to resolve "extends" path "@tsconfig/node22/tsconfig.json" referenced from .../pw162-ct/tests/tsconfig.json
Error: Failed to load tsconfig file at .../pw162-ct/tests/tsconfig.json:
Failed to resolve "extends" path "@tsconfig/node22/tsconfig.json" referenced from .../pw162-ct/tests/tsconfig.json
Error: No tests found

exit=1
```

1本も実行されません。tsconfig 自体が悪いわけではないことを tsc にも確認させました。

```
$ npx tsc -p tests/tsconfig.json --noEmit
tests/components/button.spec.ts(2,32): error TS2307: Cannot find module '../../src/components/Button.story' or its corresponding type declarations.
tests/components/counter.spec.ts(2,30): error TS2307: Cannot find module '../../src/components/Counter.story' or its corresponding type declarations.
```

`extends` については何も言いません（出ているのは jsx 設定を継いでいないための別件）。TypeScript 6.0.3 はベア指定子を普通に解決しています。1.62.1 に戻すと同じ手順で green に戻りました。

もう1件の #41998（ディレクトリ形式の project references）も再現できました。Vite scaffold の `tsconfig.json` は references をファイル形式（`{ "path": "./tsconfig.app.json" }`）で書いているので、素の状態では踏みません。自分でディレクトリ形式に書き換える必要がありました。

```json
{
  "compilerOptions": { "types": ["node"], "noEmit": true },
  "references": [{ "path": "../packages/shared" }],
  "include": ["**/*.ts"]
}
```

```
Error: Failed to load tsconfig file at .../pw162-ct/tests/tsconfig.json:
Failed to resolve "references" path "../packages/shared" referenced from .../pw162-ct/tests/tsconfig.json
Error: No tests found
```

この2件で嫌だなと思ったのは、fatal の出方が `No tests found` だという点です。「テストが0件です」というメッセージだけ見ると `testDir` や glob の設定ミスを疑って延々と探しそう。実際の本命はその上に出ている `Failed to load tsconfig file` の行です。patch を1つ上げれば直る話にこれ以上時間を使わないためにも、バージョンを明記しておく価値はあると思います。

## 旧方式との比較

旧パッケージの状況も見ておきました。`@playwright/experimental-ct-react` は latest 1.62.1 として今も publish されていて、npm 上で deprecated 指定もされていません（`npm view ... deprecated` は空）。ただ alpha の発行が `2026-08-07` で止まっている一方、`@playwright/test` の alpha は `2026-08-19` まで出ていました。急いで移行しなくてよさそうだけれど、方向は明確という感じです。

`references/migration.md` の対応表と、今回自分が書いたものを突き合わせるとこうなります。

| 旧 `@playwright/experimental-ct-*` | 新 gallery パターン | 今回書いたもの |
|---|---|---|
| `mount(<Button title="…" onClick={spy} />)` | story が state と callback を持ち、hidden form に記録。テストは `toHaveValue()` で見る | `CountsClicks` story + `expect(c.getByTestId('clicks')).toHaveValue('2')` |
| テストから plain data props | `mount(id, props)` で変わらず | `mount<typeof WithTitle>('components/Button/WithTitle', { title: 'Hello' })` |
| テストから JSX children / slots | 不可。構成ごとに story export を切る | `Primary` / `Disabled` を別 export に |
| `component.update(<Button count={2} />)` | `component.update({ count: 2 })`（root 再利用が前提） | `c.update({ value: 2, label: 'updated' })` |
| `component.unmount()` | 同じ（gallery の `window.unmount()` が裏側） | `c.unmount()` + `#root` が空になるアサート |
| `beforeMount` / `afterMount`（`playwright/index.ts`） | gallery の `window.mount` の中身、または story の decorator | `<StrictMode>` ラップを `window.mount` 内に |
| `hooksConfig` の per-test 差分 | props として渡し、story/decorator が解釈 | 今回は未使用 |
| `playwright/index.html`（styles/fonts/theme） | gallery の `index.html` / entry の import | `import '../../src/index.css'` を main.tsx に |
| `ctViteConfig` / `ctPort` / `ctTemplateDir` / `ctCacheDir` | 消滅。アプリの dev server + `webServer` + `baseURL` | `playwright.config.ts` の25行 |
| `defineConfig` from `experimental-ct-react` | `@playwright/test` の素の `defineConfig` | 同上 |

一番書き味が変わるのは callback の扱いだと思いました。旧方式は spy が Node 側にいてコンポーネントはブラウザ側、という分断があって、Playwright が両者の間で値をやり取りしていました。新方式では spy に相当するものも story の中（ブラウザ側）に置きます。callback が state を更新し、その state を `<form hidden><input data-testid="..." readOnly value={...}/></form>` として DOM に露出させる。テストは「Node に返ってきた値」ではなく、ページに見えている値を `toHaveValue()` で見ます。結果として他の Playwright のアサーションと同じ web-first（自動リトライ）の恩恵を受けられる、という理屈です。

移行コストについては、実際に旧方式のテスト群を移したわけではないので見立てですが、機械的な find & replace では終わらないと思います。テスト1本ごとに「この JSX のうち何が story に行き、何が props として残るか」を人が判断する必要があるからです。逆に新規で始めるなら覚えることは少ないです。契約は3つだけで、今回は理解してから gallery + story + spec + config で 232行でした。

余談ですが、この `references/migration.md` 自体に矛盾を見つけました。末尾の "Before / after" の "after" 例が

```ts
const component = await mount('components/Button/Default', { onClick: (data: string) => messages.push(data) });
await component.click();
```

となっているのですが、同じスキル内の他の記述と2点で食い違います。1つは `gallery-spec.md` と `SKILL.md` が「props は plain serializable data に限る、callback は story の中」と繰り返している点（関数は `page.evaluate()` 越しに渡せません）。もう1つは `SKILL.md` が「`component.getByRole('button').click()`, not `component.click()`」と明示している点です（`mount` が返すのは `#root` の Locator なので）。移行前後の対応表だけが古い書き味を引きずっているのかもしれません。新人が最初にコピーしそうな場所なので、ここは注意したほうがよさそうです。

## どんな人に向いていそうか

今回触った範囲での印象です。

新規で CT を始める人には向いていると思います。覚える契約が `window.mount` / `window.unmount` / `#root` の3つで、gallery は67行。旧方式の `ctViteConfig` 系の設定を学ばずに済むのは楽です。

既存の CT 資産がある人は、上に書いたとおり一括置換では終わりません。急ぐ必要はなさそう（旧パッケージは生きていて deprecated でもない）ですが、方向は決まっているので、新しく書くテストから新方式にしていくのが現実的でしょうか。

Storybook を併用している人は、story の粒度が近いので発想は流用しやすいはずです。ただし gallery は Storybook のような閲覧 UI ではないので、そこは別物として考えたほうがいいです。

## まとめ

最終的に7テスト全部 pass して、HTML レポートも残りました。

![HTML レポート。All 7 / Passed 7 / Failed 0 / Flaky 0](/images/playwright162-ct-stories-galleries/07-html-report.png)

ちなみに `vite build` は gallery を無視します。`dist/` に `playwright/gallery/index.html` は出ないので、gallery は dev 専用と考えて大丈夫でした。

```
$ rm -rf dist && npm run build && find dist -name '*.html'
✓ built in 112ms
dist/index.html
```

初めて触る人が踏みそうな順に並べるとこうなります。

1. `init-skills` が config も gallery も story も作らない（Markdown だけ置く）
2. `SKILL.md` が指す `templates/` が同梱されていない
3. gallery を作る前に上げた dev server を使い回すと、1件だけ落ちる
4. `baseURL` を origin だけにすると全落ちする
5. gallery で root を作り直すと `update()` が再マウントになる
6. story id は実行時の文字列なので、リネームはビルドを通り抜ける

最短の再現手順としてはこの並びです。

```bash
mkdir pw162-ct && cd pw162-ct
npm create vite@latest . -- --template react-ts
npm install
npm i -D @playwright/test@1.62.1
npx playwright install chromium

# src/components/{Button,Counter}.tsx と *.story.tsx、
# playwright/gallery/{index.html,main.tsx}、playwright.config.ts、tests/components/*.spec.ts を作る
# （init-skills は .claude/skills/ に Markdown を置くだけなので、コードは自分で書く）

# gallery を作った「後」に dev server を上げる（重要）
npx playwright test --project=components
```

手を動かす部分は 232行しかなくて、実際に時間を食ったのはコードを書くところではなく、gallery の契約を読み解くところと、上の3番の原因を切り分けるところでした。あくまで見立てですが、初見で読むなら gallery の契約の理解にいちばん時間を割くつもりでいるといいと思います。

次に試したいこととしては、gallery のインデックスを export 単位にする、`toHaveScreenshot()` に繋げて VRT にする、`page.route()` と `serviceWorkers: 'block'` の組み合わせを確かめる、あたりを考えています。あと未解決のまま残った「22回に1回落ちた件」は、条件が分かったら追記したいです。

最後に一番実用的な結論だけ書いておくと、CT を始めるなら `@playwright/test@1.62.1` 以上を指定してください。1.62.0 の tsconfig 回帰は `No tests found` という誤読しやすい形で出ます。

## 参考リンク

- [Components | Playwright](https://playwright.dev/docs/test-components)
- [Release v1.62.0 · microsoft/playwright](https://github.com/microsoft/playwright/releases/tag/v1.62.0)
- [Release v1.62.1 · microsoft/playwright](https://github.com/microsoft/playwright/releases/tag/v1.62.1)
- [Test configuration | Playwright](https://playwright.dev/docs/test-configuration)
- [import.meta.glob | Vite](https://vite.dev/guide/features.html#glob-import)
