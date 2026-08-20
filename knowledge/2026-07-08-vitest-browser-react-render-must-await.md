---
title: "vitest-browser-react の render は Promise を返す（await しないと screen.getByText is not a function）"
date: "2026-07-08"
cause_category: "API"
tech: [vitest, browser-mode, react, testing]
error_type: [TypeError, NotAFunction]
library: [vitest, vitest-browser-react, "@vitest/browser-playwright"]
keywords: [vitest browser mode, vitest-browser-react, render await, screen.getByText is not a function, RenderResult, Promise, レンダリングテスト]
status: "resolved"   # resolved | workaround | unresolved
---

# 開発ナレッジ報告書

## タイトル
vitest-browser-react の render は Promise を返す（await しないと screen.getByText is not a function）

## 概要
Vitest 4 Browser Mode + `vitest-browser-react` (v2.2.0) でレンダリングテストを書いた際、`const screen = render(<Card ... />)` と同期的に受けて `screen.getByText(...)` を呼んだところ `TypeError: screen.getByText is not a function` で落ちた。`vitest-browser-react` の `render` は `Promise<RenderResult>` を返すため、`const screen = await render(...)` と await すれば解決する。

## 背景
- プロジェクト: 024_zenn（run-practice で Vitest 4 Browser Mode を検証中）
- 技術スタック: Node v22.17.0, vitest 4.1.10, @vitest/browser-playwright 4.1.10, vitest-browser-react 2.2.0, React 19.2, Vite 8, macOS 26.5
- 発生タイミング: 初めてのレンダリングテスト実行時（`npx vitest run --browser.headless`）

## 問題
- 期待した挙動: `render` の戻り値から `getByText` などのロケータが使える。
- 実際の挙動: `screen` が Promise のため関数が生えておらず TypeError。
- エラーメッセージ:
  ```
  FAIL  |chromium| src/Card.test.tsx > Card renders title and body text
  TypeError: screen.getByText is not a function
   ❯ src/Card.test.tsx:8:30
        8|   await expect.element(screen.getByText('Hello Vitest')).toBeVisible()
  ```

## 原因
`vitest-browser-react` v2 の `render` は型定義上 `declare function render(...): Promise<RenderResult>` となっており、非同期。従来の（React Testing Library の）同期 `render` の感覚で書くと、戻り値が Promise になり、ロケータメソッドが存在しない。

## 解決策
`render` を await する。

```tsx
// NG: 同期で受けると screen は Promise
const screen = render(<Card title="Hello" body="..." />)

// OK: await して RenderResult を受ける
const screen = await render(<Card title="Hello" body="..." />)
await expect.element(screen.getByText('Hello')).toBeVisible()
```
