# Knowledge Index

Index of development troubles and resolutions (newest first).
Search: `grep -ri "<keyword>" knowledge/`

このフォルダの仕組みと使い方は [README.md](./README.md) を参照。

## Entries

- [2026-07-11] [Biome の linter.domains.types を "all" にしても nursery の型認識ルールが自動発火しない](./2026-07-11-biome-types-domain-all-not-enabling-nursery-rules.md) — `Configuration` / tags: biome, typescript, SilentNoOp, type-aware
- [2026-07-11] [planステージがCodexサンドボックスで実行できない検証計画（実ブラウザ起動・deno upgrade等）を立ててしまう](./2026-07-11-codex-sandbox-infeasible-practice-plans.md) — `Environment` / tags: codex, sandbox, playwright, deno, docker
- [2026-07-11] [gh pr merge --auto が branch protection の無いリポジトリで不安定に失敗する](./2026-07-11-gh-pr-merge-auto-unstable-without-protection.md) — `External Service` / tags: gh, github, AutoMergeSetupFailed
- [2026-07-11] [Codexパイプラインが successful stage result must have an empty reason で失敗する](./2026-07-11-codex-stage-result-empty-reason-contract.md) — `Code/Logic` / tags: codex, bash, node, StageResultContractFailed
- [2026-07-10] [CSS Anchor Positioningのposition-try-fallbacksが発火しないときはcontaining blockを確認する](./2026-07-10-css-anchor-position-try-fallbacks-containing-block.md) — `Config` / tags: css, anchor-positioning, position-try-fallbacks, containing-block
- [2026-07-09] [typescript-eslint 8.x が TypeScript 7.x で `Cannot read properties of undefined (reading 'Cjs')` でクラッシュする](./2026-07-09-typescript-eslint-typescript7-cjs-crash.md) — `Dependency` / tags: typescript-eslint, typescript-7, Cjs, PeerDependencyMismatch
- [2026-07-08] [Vitest toMatchScreenshot の allowedMismatchedPixelRatio は comparatorOptions 配下に置く](./2026-07-08-vitest-tomatchscreenshot-allowedmismatch-nesting.md) — `Config` / tags: vitest, toMatchScreenshot, comparatorOptions, visual-regression
- [2026-07-08] [vitest-browser-react の render は Promise を返す](./2026-07-08-vitest-browser-react-render-must-await.md) — `API` / tags: vitest, browser-mode, react, render-await
- [2026-07-05] [`npx tsc` が本物のTypeScriptではなく別パッケージ(tsc@2.0.4)に解決されて型チェックできない](./2026-07-05-npx-tsc-resolves-squatter-package.md) — `Dependency` / tags: node, typescript, npx, WrongPackageResolved
- [2026-07-02] [bashで変数展開の直後に全角文字が接すると unbound variable でパースが壊れる](./2026-07-02-bash-fullwidth-char-after-variable-unbound.md) — `Environment` / tags: bash, macos, unbound-variable, 全角
- [2026-07-01] [Zennの記事slugがサイト全体で重複していて保存に失敗する](./2026-07-01-zenn-slug-already-used.md) — `Config` / tags: zenn, zenn-cli, SlugAlreadyUsed, slug
- [2026-06-22] [Spring Bootアプリがポート8080競合で起動しない](./2026-06-22-spring-boot-port-8080-in-use.md) — `Resource` / tags: java, spring-boot, PortInUse, ポート競合 _(初期サンプル)_
