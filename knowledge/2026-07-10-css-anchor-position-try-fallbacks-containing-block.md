---
title: "CSS Anchor Positioningのposition-try-fallbacksが発火しないときはcontaining blockを確認する"
date: "2026-07-10"
cause_category: "Config"
tech: [css, anchor-positioning, playwright, chromium]
error_type: [FallbackNotApplied, UnexpectedClamping]
library: [playwright]
keywords: [position-try-fallbacks, flip-inline, position-area, containing block, anchor positioning]
status: "resolved"
---

# CSS Anchor Positioning: position-try-fallbacks(flip-*) が発火しない / はみ出しを再現できない

- 日付: 2026-07-10
- 技術: CSS Anchor Positioning（`position-anchor` / `anchor()` / `position-area` / `position-try-fallbacks`）
- 環境: Chromium 149.0.7827.55（Playwright 1.61.1）/ macOS

## Context / 状況
JSなしのポップオーバーで「画面端に寄せたら反対側に回り込む」フォールバックを
`position-try-fallbacks: flip-inline` で検証しようとした。Playwright スクショで
「フォールバック前（はみ出す）／後（収まる）」の2枚を撮って差分を見たかった。

## Problem / 症状
1. `flip-inline` を付けても位置が変わらない。before/after のスクショが同一で、
   ポップオーバーは右端をはみ出したまま（`getBoundingClientRect().right` が before/after とも同値）。
2. 逆に `position-area: right center` + `position: fixed` にすると、フォールバック無しでも
   常にビューポート内に収まってしまい、「はみ出す before」自体を作れなかった（right が viewport幅に張り付く）。

## Cause / 原因
`position-try-fallbacks` のはみ出し判定も、`position-area` の自動クランプも、
**その要素の containing block（包含ブロック）が何か**に強く依存する。

- 症状1: positioned 要素を「ボタンサイズしかない小さな `position: relative` 祖先」の中に
  入れていた。containing block がボタンサイズになり、要素はどの方向にも“はみ出し”状態に
  なるためフォールバック判定が正しく働かず flip しなかった。
- 症状2: `position-area` + `position: fixed`（containing block = ビューポート）は、
  要素をその領域＝ビューポート内に収めるよう自動調整するため、そもそもはみ出さない。

## Solution / 効いた対処
「本当にビューポートをはみ出す状況」を作るには、containing block をビューポート相当
（＝ positioned 祖先を作らない Initial Containing Block）にし、**明示 inset** で配置する:

```css
/* NG: 小さな relative 祖先の中 / position-area+fixed だと再現できない */

/* OK: positioned 祖先なし（ICB基準）＋ 明示 inset で右に開く → 本当にはみ出す */
#btn { position: absolute; right: 24px; anchor-name: --edge; }
.pop {
  position: absolute;            /* 近い positioned 祖先を作らない */
  position-anchor: --edge;
  left: anchor(right);           /* ボタン右に開く（明示 inset。position-area は自動クランプするので避ける） */
  top: anchor(top);
  position-try-fallbacks: flip-inline;  /* はみ出したら左へ回り込む */
}
```

これで before（`right`=1006, vw=800 をはみ出し）→ after（`right`=667, 収まる）と
flip-inline が発火し、Playwright スクショでも差分を確認できた。

## 教訓
- anchor 系のはみ出し回避（`position-try-fallbacks`）とクランプ（`position-area`）は
  **containing block 依存**。`fixed` / `absolute` / ラッパの `position: relative` で挙動が変わる。
- フォールバックの検証は「はみ出す状況を意図的に作れているか」を
  `getBoundingClientRect().right > viewportWidth` で数値確認してから判定する。
