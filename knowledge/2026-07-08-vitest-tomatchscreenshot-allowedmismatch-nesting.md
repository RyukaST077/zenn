---
title: "Vitest toMatchScreenshot の allowedMismatchedPixelRatio はトップレベルに書くと無視される（comparatorOptions配下に置く）"
date: "2026-07-08"
cause_category: "Config"
tech: [vitest, browser-mode, visual-regression]
error_type: [OptionIgnored, MisplacedOption]
library: [vitest, "@vitest/browser-playwright"]
keywords: [toMatchScreenshot, allowedMismatchedPixelRatio, comparatorOptions, comparatorName, pixelmatch, ビジュアルリグレッション, 閾値, threshold, 無視される]
status: "resolved"   # resolved | workaround | unresolved
---

# 開発ナレッジ報告書

## タイトル
Vitest toMatchScreenshot の allowedMismatchedPixelRatio はトップレベルに書くと無視される（comparatorOptions配下に置く）

## 概要
Vitest 4 Browser Mode の `toMatchScreenshot` で差分許容量を上げようと、第2引数のオプション直下に `allowedMismatchedPixelRatio: 0.2` を書いたが、差分 ratio 0.12（0.2 未満）にもかかわらず赤のまま落ちた。`allowedMismatchedPixelRatio` は `comparatorOptions`（pixelmatch コンパレータのオプション）配下に置く必要があり、トップレベルに書くと型エラーにもならず黙って無視される。

## 背景
- プロジェクト: 024_zenn（run-practice で Vitest 4 Browser Mode を検証中）
- 技術スタック: Node v22.17.0, vitest 4.1.10, @vitest/browser-playwright 4.1.10, macOS 26.5
- 発生タイミング: フェーズ4「どのくらいの差までなら緑にできるか」の閾値調整時

## 問題
- 期待した挙動: `allowedMismatchedPixelRatio: 0.2` を渡せば ratio 0.12 の差分は緑になる。
- 実際の挙動: 赤のまま。「2088 pixels (ratio 0.12) differ.」で失敗。
- エラーメッセージ（該当部）:
  ```
  FAIL  |chromium| src/Card.test.tsx > Card matches the visual baseline
  Screenshot does not match the stored reference.
  2088 pixels (ratio 0.12) differ.
  ```

## 原因
Vitest 4 の `ScreenshotMatcherOptions` では、比較アルゴリズム（既定 `pixelmatch`）のパラメータは `comparatorOptions` の下にネストする設計。`allowedMismatchedPixels` / `allowedMismatchedPixelRatio` / `threshold` は `StandardScreenshotComparators.pixelmatch` の型に属する。オプション直下に同名キーを書いても未知キーとして無視され、既定（実質0許容）で比較され続ける。

## 解決策
`comparatorName` と `comparatorOptions` を使ってネストする。

```ts
// NG: トップレベルに書くと黙って無視される
await expect(page.getByTestId('card')).toMatchScreenshot('card', {
  allowedMismatchedPixelRatio: 0.2,
})

// OK: comparatorOptions の下に置く
await expect(page.getByTestId('card')).toMatchScreenshot('card', {
  comparatorName: 'pixelmatch',
  comparatorOptions: { allowedMismatchedPixelRatio: 0.2 },
})
```
