# Knowledge Index

Index of development troubles and resolutions (newest first).
Search: `grep -ri "<keyword>" knowledge/`

このフォルダの仕組みと使い方は [README.md](./README.md) を参照。

## Entries

- [2026-09-29] [必須チェック追加後に公開キュー/キューPRの自動マージが失敗し、retry PRが毎時重複する](./2026-09-29-publish-queue-merge-before-required-checks.md) — `Code/Logic` / tags: github, gh-cli, merge-failure, duplicate-pr, publish-queue
- [2026-09-29] [AI記事がレビュー合格後にslugと登録済み契約の不一致で停止する](./2026-09-29-agent-article-slug-contract-mismatch.md) — `Code/Logic` / tags: slug, article-contract, registration, resume, publication-queue
- [2026-09-24] [unsnoozeのNode標準テストもnpm ciなしではpicocolors不足になる](./2026-09-24-unsnooze-tests-missing-dependencies.md) — `Dependency` / tags: unsnooze, npm-ci, picocolors, node-test
- [2026-09-24] [Codex記事パイプラインのplanが記事契約なしで停止する](./2026-09-24-codex-search-missing-article-contract.md) — `Code/Logic` / tags: codex, article-contract, search-topic, plan-practice, worktree
- [2026-09-24] [Codex記事パイプラインのworktree引き継ぎで--search-argsが消える](./2026-09-24-codex-pipeline-dispatch-loses-arguments.md) — `Code/Logic` / tags: bash, codex, search-args, worktree, shift
- [2026-08-18] [Claude Codeの--json-schemaが2020-12メタスキーマ宣言を拒否する](./2026-08-18-claude-json-schema-metaschema-rejected.md) — `Compatibility` / tags: claude-code, json-schema, draft-2020-12, structured-output
- [2026-08-18] [TypeScript 7.0 に上げると typescript-eslint が `typescript-eslint does not support TS 7.0.` で起動不能になる（公式 alias 併用構成で解決）](./2026-08-18-typescript7-eslint-alias-side-by-side.md) — `Dependency` / tags: typescript-7, typescript-eslint, alias, "@typescript/native", tsc6, bin衝突
- [2026-08-18] [macOS Bash 3.2でset -u下の空配列展開がunbound variableになる](./2026-08-18-bash32-empty-array-nounset.md) — `Environment` / tags: bash, macos, bash-3.2, nounset, empty-array
- [2026-08-18] [Claude版記事パイプラインが過去の要修正判定を誤読してsession limitで停止する](./2026-08-18-claude-review-verdict-first-match-session-limit.md) — `Code/Logic` / tags: claude-code, verdict, structured-output, session-limit, auto-publish
- [2026-08-14] [macOSのNode製fake CLIが unexpected environment name で事前検証に失敗する](./2026-08-14-macos-node-fake-cli-cf-user-text-encoding.md) — `Environment` / tags: macos, node, fake-cli, preflight, __CF_USER_TEXT_ENCODING
- [2026-08-14] [Deno.test.each() で TestContext を受け取ると TS2339 になる（引数の順序）](./2026-08-14-deno-test-each-testcontext-arg-order.md) — `API` / tags: deno, Deno.test.each, TestContext, assertSnapshot, TS2339
- [2026-08-14] [deno upgrade が built without the upgrade feature で拒否される](./2026-08-14-deno-upgrade-built-without-upgrade-feature.md) — `Environment` / tags: deno, Homebrew, UpgradeFeatureDisabled, brew upgrade deno
- [2026-08-09] [zshでglobを含む引数（--include=*.js / --test-coverage-include=src/**）が no matches found で実行前に落ちる](./2026-08-09-zsh-nomatch-glob-argument.md) — `Configuration` / tags: zsh, bash, NoMatchesFound, glob, クォート
- [2026-07-11] [Biome の linter.domains.types を "all" にしても nursery の型認識ルールが自動発火しない](./2026-07-11-biome-types-domain-all-not-enabling-nursery-rules.md) — `Configuration` / tags: biome, typescript, SilentNoOp, type-aware
- [2026-07-11] [planステージがCodexサンドボックスで実行できない検証計画（実ブラウザ起動・deno upgrade等）を立ててしまう](./2026-07-11-codex-sandbox-infeasible-practice-plans.md) — `Environment` / tags: codex, sandbox, playwright, deno, docker
- [2026-07-11] [gh pr merge --auto が branch protection の無いリポジトリで不安定に失敗する](./2026-07-11-gh-pr-merge-auto-unstable-without-protection.md) — `External Service` / tags: gh, github, AutoMergeSetupFailed
- [2026-07-11] [Codexパイプラインが successful stage result must have an empty reason で失敗する](./2026-07-11-codex-stage-result-empty-reason-contract.md) — `Code/Logic` / tags: codex, bash, node, StageResultContractFailed, metadata-verdict, stage-schema _(2026-07-12追記)_
- [2026-07-10] [CSS Anchor Positioningのposition-try-fallbacksが発火しないときはcontaining blockを確認する](./2026-07-10-css-anchor-position-try-fallbacks-containing-block.md) — `Config` / tags: css, anchor-positioning, position-try-fallbacks, containing-block
- [2026-07-09] [typescript-eslint 8.x が TypeScript 7.x で `Cannot read properties of undefined (reading 'Cjs')` でクラッシュする](./2026-07-09-typescript-eslint-typescript7-cjs-crash.md) — `Dependency` / tags: typescript-eslint, typescript-7, Cjs, PeerDependencyMismatch
- [2026-07-08] [Vitest toMatchScreenshot の allowedMismatchedPixelRatio は comparatorOptions 配下に置く](./2026-07-08-vitest-tomatchscreenshot-allowedmismatch-nesting.md) — `Config` / tags: vitest, toMatchScreenshot, comparatorOptions, visual-regression
- [2026-07-08] [vitest-browser-react の render は Promise を返す](./2026-07-08-vitest-browser-react-render-must-await.md) — `API` / tags: vitest, browser-mode, react, render-await
- [2026-07-05] [`npx tsc` が本物のTypeScriptではなく別パッケージ(tsc@2.0.4)に解決されて型チェックできない](./2026-07-05-npx-tsc-resolves-squatter-package.md) — `Dependency` / tags: node, typescript, npx, WrongPackageResolved
- [2026-07-02] [bashで変数展開の直後に全角文字が接すると unbound variable でパースが壊れる](./2026-07-02-bash-fullwidth-char-after-variable-unbound.md) — `Environment` / tags: bash, macos, unbound-variable, 全角
- [2026-07-01] [Zennの記事slugがサイト全体で重複していて保存に失敗する](./2026-07-01-zenn-slug-already-used.md) — `Config` / tags: zenn, zenn-cli, SlugAlreadyUsed, slug
- [2026-06-22] [Spring Bootアプリがポート8080競合で起動しない](./2026-06-22-spring-boot-port-8080-in-use.md) — `Resource` / tags: java, spring-boot, PortInUse, ポート競合 _(初期サンプル)_
