# notes.md — Vite 8 (Rolldown) 実測メモ

## 計測条件（フェーズ1で決定）
- マシン: Apple M2 Pro / 10 cores / 16GB RAM / macOS 26.5 (arm64)
- Node: v22.17.0（要件 20.19+ / 22.12+ を満たす → OK）
- npm: 10.9.2 / pnpm: 10.13.1 / corepack: 0.33.0
- cold の定義: 各回の前に `rm -rf node_modules/.vite dist` してからビルド/dev起動
- warm の定義: 直後（キャッシュ有り）に連続でもう一度実行、2回目以降
- 回数: build cold 3回 / dev ready 3回（cold/warm 区別）
- build 計測: `/usr/bin/time -p pnpm build` の real、およびビルドログ末尾
- dev 計測: 起動ログの "ready in xxx ms"

## Node要件判定
- node -v = v22.17.0 → 22.12+ を満たす。Vite 8 起動可能。対処不要。

## npm 上の実バージョン（2026-07-02 確認）
- vite dist-tags: latest=8.1.3, previous=7.3.6, beta=8.1.0-beta.0
- rolldown-vite: latest=7.3.1
