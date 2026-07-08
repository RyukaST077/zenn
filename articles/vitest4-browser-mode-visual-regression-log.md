---
title: "Vitest 4 の Browser Mode で toMatchScreenshot を初めて書いてみた"
emoji: "📸"
type: "tech"
topics: ["vitest", "playwright", "react", "typescript", "testing"]
published: true
---

<!-- 前提: 出典ログ logs/run-vitest-browser-mode-20260708-1748/execution-log.md / 記事タイプ: 検証ログ・試してみた / published: false（ドラフト） -->

## はじめに

これまでフロントのテストは JSDOM（`@testing-library/react` + Vitest）でしか書いたことがありませんでした。テキストが出ているか、ボタンを押すと state が変わるか、といった検証はそれで十分だったのですが、「見た目が壊れてないか」だけはどうにも確かめようがない。CSS を一行いじって全体のレイアウトが崩れても、テストは緑のままです。

そこで Vitest 4 の Browser Mode と `toMatchScreenshot`（ビジュアルリグレッションテスト）を触ってみることにしました。実ブラウザ（Chromium）でコンポーネントを描画して、その見た目をスクリーンショットで固定し、次回以降と画像で比較する仕組みです。

この記事では、Vite + React + TypeScript の最小プロジェクトに Vitest 4 の Browser Mode を入れて、

- レンダリングテスト1本（テキストが表示されるか）
- `toMatchScreenshot` によるビジュアルリグレッションテスト1本（見た目が変わったら落ちる）

を書くところまでを、詰まった点も含めてそのまま残します。結論から言うと最後まで動きましたが、道中で5回くらい詰まりました。

:::message
筆者はフロントのテストは JSDOM しか書いたことがない状態で、Browser Mode を触るのは初めてです。手元の Mac（macOS 26.5 / platform=darwin、Node v22.17.0、pnpm 10.13.1）で一通り試しました。
:::

## なぜブラウザモードを試すのか

JSDOM は DOM の構造とテキストまでは見られますが、実際のレイアウトや描画は持っていません。今回それを一番はっきり確認できたのが `getBoundingClientRect()` でした。JSDOM 環境で Card コンポーネントの幅を測ると、CSS で `width: 280px` を指定していても `0` が返ってきます。

```tsx:src/Card.jsdom.test.tsx
// JSDOM には実際のレイアウトやピクセルが無い。
// getBoundingClientRect も 0 を返すため「見た目」は検証できないことを確認する。
test('[jsdom] JSDOM has no real layout/pixels (cannot do visual regression)', () => {
  render(<Card title="Hello Vitest" body="ブラウザモードのレンダリングテスト" />)
  const card = screen.getByTestId('card')

  const rect = card.getBoundingClientRect()
  // 実ブラウザなら幅280px前後になるが、JSDOMでは 0
  expect(rect.width).toBe(0)
  expect(rect.height).toBe(0)
})
```

このテストは通ります（つまり本当に `0`）。見た目の回帰を守りたいなら、原理的に実ブラウザで描画するしかない、というのが Browser Mode を試す動機でした。

## 事前に調べたこと（v3 との違い）

先に v4 の変更点を軽く調べたのですが、ここで知っておいてよかったのが2点です。

- **provider が別パッケージに分離した。** v3 系では `@vitest/browser` に Playwright provider が同梱で、`provider: 'playwright'` と文字列で指定していました。v4 では provider が `@vitest/browser-playwright` という別パッケージになり、渡し方も factory 形式（関数呼び出し）に変わっています。
- **`toMatchScreenshot` は初回が必ず失敗する。** ベースライン画像が無い初回はそれを生成したうえで、あえてテストを落とす仕様。これを知らないと初回の赤で「壊れた」と勘違いします。

この2つは後述のとおり本当に踏みました。事前に読んでいなかったら確実に時間を溶かしていたと思います。

## 環境構築

まず Vite の React + TypeScript テンプレートで最小プロジェクトを作ります。

```bash
pnpm create vite my-app --template react-ts
cd my-app && pnpm install
```

入ったのは React 19.2.7 / Vite 8.1.3 / TypeScript 6.0.3 でした。

続いて Vitest 4 一式と Chromium バイナリを入れます。

```bash
pnpm add -D vitest@4 @vitest/browser-playwright vitest-browser-react
npx playwright install chromium
```

実バージョンは `vitest 4.1.10` / `@vitest/browser-playwright 4.1.10` / `vitest-browser-react 2.2.0` でした。

`vitest.config.ts` はこうなりました。ポイントは `provider` に `playwright()` を **import して関数として渡す** ところです。

```ts:vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/*.jsdom.test.tsx'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

参考までに、環境構築の起点になった Vite の初期画面です。

![Vite（React + TypeScript）の初期表示](/images/vitest4-browser-mode-visual-regression-log/01-vite-initial.png)

なお `pnpm add -D playwright` を後から明示的に足しています。理由は「詰まった点」に書きます。

## 実際に書いたテスト

テスト対象は、青いボーダーの付いたシンプルな Card コンポーネントにしました。ボーダーの色や太さは見た目の差分として分かりやすいので、ビジュアルリグレッションの題材に向いています。

```tsx:src/Card.tsx
import './Card.css'

type CardProps = {
  title: string
  body: string
}

export function Card({ title, body }: CardProps) {
  return (
    <div className="card" data-testid="card">
      <h2 className="card__title">{title}</h2>
      <p className="card__body">{body}</p>
    </div>
  )
}
```

```css:src/Card.css
.card {
  width: 280px;
  padding: 16px;
  border: 4px solid #3b82f6;
  border-radius: 12px;
  background: #ffffff;
  font-family: system-ui, sans-serif;
}
```

テストは2本。テキストが表示されるかのレンダリングテストと、`toMatchScreenshot` によるビジュアルリグレッションテストです。

```tsx:src/Card.test.tsx
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Card } from './Card'

test('Card renders title and body text', async () => {
  const screen = await render(<Card title="Hello Vitest" body="ブラウザモードのレンダリングテスト" />)

  await expect.element(screen.getByText('Hello Vitest')).toBeVisible()
  await expect.element(screen.getByText('ブラウザモードのレンダリングテスト')).toBeVisible()
})

test('Card matches the visual baseline', async () => {
  await render(<Card title="Hello Vitest" body="ブラウザモードのレンダリングテスト" />)

  await expect(page.getByTestId('card')).toMatchScreenshot('card')
})
```

初回実行でベースライン画像を生成し、2回目で緑になったときに保存された画像がこれです。青いボーダーの Card がそのまま撮られています。

![生成されたベースライン画像（青ボーダーの Card）](/images/vitest4-browser-mode-visual-regression-log/02-baseline-card.png)

このベースラインは `src/__screenshots__/Card.test.tsx/card-chromium-darwin.png` に出ます。ファイル名に `-darwin`（platform）が入っているのが、あとで気になる点でした（後述）。

## 詰まった点

事前に調べていた2つ以外に、v3 の記事や RTL の感覚で類推して踏んだものが多かったです。

### provider を文字列で書くと起動エラー

まず v3 のノリで `provider: 'playwright'` と文字列で書いたら、起動時にこう出ました。

```
⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
TypeError: The `browser.provider` configuration was changed to accept a factory instead of a string. Add an import of "playwright" from "@vitest/browser-playwright" instead. See: https://vitest.dev/config/browser/provider
```

「文字列じゃなく factory を受け取るようになった。`@vitest/browser-playwright` から import しろ」と、直し方まで書いてくれています。事前に分離を知っていたのもあって、これはすぐ直せました。

### render を await しないと `getByText is not a function`

次に、レンダリングテストで最初 `const screen = render(...)` と同期で受けたら落ちました。

```
FAIL  |chromium| src/Card.test.tsx > Card renders title and body text
TypeError: screen.getByText is not a function
 ❯ src/Card.test.tsx:8:30
```

`@testing-library/react` の `render` は同期なので、その感覚で書いていたのですが、`vitest-browser-react` v2 の `render` は `Promise<RenderResult>` を返します。`const screen = await render(...)` にしたら通りました。地味ですが、RTL 経験があるほど引っかかりそうです。

### 初回のスクショは必ず失敗する

`toMatchScreenshot('card')` を足して初回を実行すると、赤になります。

```
FAIL  |chromium| src/Card.test.tsx > Card matches the visual baseline
No existing reference screenshot found; a new one was created. Review it before running tests again.
Reference screenshot:
  .../src/__screenshots__/Card.test.tsx/card-chromium-darwin.png
```

これは事前に「初回は必ず落ちる」と知っていたので慌てずに済みました。生成されたベースライン画像を目で確認して、もう一度実行すれば緑になります（`Tests 2 passed`）。知らないと「設定を間違えた？」と探し回るところだったと思います。

ちなみにこの初回のときに `@vitest/browser/context` からの import が DEPRECATED という警告も出ていて、`import { page } from 'vitest/browser'` に直したら消えました。

### playwright 本体が解決できない

スクリーンショットを別スクリプトから撮ろうとしたときに `import 'playwright'` が解決できず、`pnpm add -D playwright@1.61.1` で直接依存に昇格させて解決しました。`playwright` 本体は `@vitest/browser-playwright` の推移的な依存としては入るのですが、pnpm は直接依存しか `node_modules` 直下に symlink しないので、直接 import しようとすると見つからない、という仕組みでした。テスト実行だけなら踏まないかもしれませんが、ハマったので残しておきます。

### allowedMismatchedPixelRatio をトップレベルに書くと無視される

これが一番「気づけないやつ」でした。差分許容の閾値を試そうと、こう書きました。

```ts
await expect(page.getByTestId('card')).toMatchScreenshot('card', {
  allowedMismatchedPixelRatio: 0.2,
})
```

後述のとおり差分は ratio 0.12 なので 0.2 未満、緑になるはずなのに赤のままです。

```
Screenshot does not match the stored reference.
2088 pixels (ratio 0.12) differ.
```

型定義（`ScreenshotMatcherOptions`）を追ってみると、pixelmatch のパラメータは `comparatorOptions` 配下にネストする設計でした。トップレベルに同名キーを書いても黙って無視されます（エラーも警告も出ない）。正しくはこう。

```ts
await expect(page.getByTestId('card')).toMatchScreenshot('card', {
  comparatorName: 'pixelmatch',
  comparatorOptions: { allowedMismatchedPixelRatio: 0.2 },
})
// → Tests 2 passed
```

これで同じ差分が緑になりました。型を読まないと気づけないので、閾値をいじるときは公式の型定義を見に行くのが早いと思います。

## 触ってみて分かったこと

一番おもしろかったのは、CSS を意図的に変えたときの挙動です。ボーダーの色を `#3b82f6`（青）から `#ef4444`（赤）に変えて実行したら、こう落ちました。

```
FAIL  |chromium| src/Card.test.tsx > Card matches the visual baseline
Screenshot does not match the stored reference.
2088 pixels (ratio 0.12) differ.
Actual screenshot:
  .../.vitest-attachments/src/Card.test.tsx/card-actual-chromium-darwin.png
Diff image:
  .../.vitest-attachments/src/Card.test.tsx/card-diff-chromium-darwin.png
```

「2088ピクセル（比率 0.12）が違う」と数字で出て、expected / actual / diff の3枚が保存されます。ここで置き場所が分かれていて、expected（ベースライン）は `__screenshots__/` に、actual と diff は `.vitest-attachments/` に出ます。最初どこに出たのか探しました。

実際の3枚がこちらです。

expected（元の青ボーダー）:

![expected: 元の青ボーダー](/images/vitest4-browser-mode-visual-regression-log/03-diff-expected.png)

actual（赤ボーダーに変えた後）:

![actual: 赤ボーダーに改変後](/images/vitest4-browser-mode-visual-regression-log/04-diff-actual.png)

diff（変わった箇所を強調）:

![diff: pixelmatch による差分](/images/vitest4-browser-mode-visual-regression-log/05-diff-diff.png)

diff 画像でボーダーの部分がちゃんと強調されていて、「見た目の回帰をピクセル単位で捕まえている」のが目で分かります。閾値（`allowedMismatchedPixelRatio`）は、アンチエイリアス等の微小差だけ許したいときに使うものだと理解しました。ただ安易に上げると本物のリグレッションも見逃すので、そこは慎重にやるべきだなと思っています。

## JSDOM と比べて感じたこと

比較のために、Browser Mode を使わない従来型の JSDOM 設定も別ファイルで用意しました。

```ts:vitest.jsdom.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.jsdom.test.tsx'],
  },
})
```

ここでも一つ詰まりました。JSDOM 側では `@testing-library/react` を使うのですが、明示的な cleanup を入れないと2テスト目で `Found multiple elements by: [data-testid="card"]` と落ちます。Browser Mode の `render` は自動でクリーンアップしてくれるので油断していました。`afterEach(() => cleanup())` を入れて解決です。

```tsx:src/Card.jsdom.test.tsx
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Card } from './Card'

// ブラウザモードの render は自動でクリーンアップされるが、
// @testing-library/react は明示的な cleanup が要る（怠ると要素が重複して落ちる）。
afterEach(() => cleanup())
```

そのうえで、冒頭に書いた `getBoundingClientRect()` が `0` を返す件も含めて、「JSDOM は DOM 構造とテキストまでは見られるが、レイアウト・色・描画は原理的に見られない」ことをはっきり確認できました。`toMatchScreenshot` は実ブラウザ描画が前提なので、この2つは役割が別なんだな、という整理がつきました。

## まとめ

やりたかった3つ（緑で起動、ベースライン生成、CSS 改変で赤 + 差分画像）は全部確認できました。JSDOM しか知らなかった状態からでも、コンポーネント1個ぶんなら半日かからずに一通り触れる範囲だったと思います。

向いていそうなのは、UI の見た目の回帰を守りたいチーム。ボタンやカードのような細かい部品を、意図しない CSS 変更から守るのに素直に効きそうです。

一方でまだ引っかかっているのが、ベースライン画像のファイル名に `-darwin` が入る点です。手元は Mac ですが、CI が Linux だとフォント描画などで画像が一致しない可能性が高い。実運用ではおそらく Docker などで描画環境を固定するのが前提になりそうで、そこはまだ試せていません。次はそのあたりを確かめたいです。

## 参考リンク

https://vitest.dev/guide/browser/

https://vitest.dev/config/browser/provider
