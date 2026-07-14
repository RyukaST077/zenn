# Review: node26-package-map-store-gate

verdict: fix
blockers: 0
warnings: 1

## 対象

- Article: `articles/node26-package-map-store-gate.md`
- Execution log: `logs/run-node26-package-maps-20260713-141143/execution-log.md`
- Deterministic check: `bash scripts/check-article.sh articles/node26-package-map-store-gate.md --expect-published false` -> `OK`
- Effective sandbox mode: `danger-full-access`
- Browser verification: browser-independentなNode.js / pnpm CLI検証であり、execution logにもbrowser gateはnot applicableと記録されているため対象外。

## Findings

### Warning 1: 「実行したassertion」として示したコマンドが記録済みコマンドの入力pathと一致せず、再現手順としても前提が不足している

- Article location: `articles/node26-package-map-store-gate.md:63-80`
- 記事は`<WORK>`の意味を説明した後、3コマンドを示し、続けて「実行したassertion」として`pnpm-store-dir.stdout`だけを読むコマンドを掲載している。しかしexecution logのchronological recordでは、assertionが読んだファイルは`work/evidence/toolchain/pnpm-store-dir.stdout`である（`execution-log.md:53-54`）。記事の直前の3コマンドはstdout保存処理も示していないため、掲載されたassertionをそのまま実行しても入力ファイルは作られない。
- また、negative observationの再現条件には`npm_config_store_dir`だけでなく、runで使用した`XDG_CONFIG_HOME`などの隔離用exportと記録wrapperが関係し得る。execution logは「isolation exports from the supplied plan」を使うよう求めており（`execution-log.md:147-156`）、planには完全なexport群と`run-recorded.sh`が残っている（`practice/practice-node26-package-maps-20260713-1404.md:69-119`）。現状の「再現手順」は、実測の限定条件を再現するにはmaterialに曖昧である。
- Fix: assertionを実コマンドの忠実なredacted表現（例: `<WORK>/evidence/toolchain/pnpm-store-dir.stdout`を読む形）へ直し、stdoutをそのpathへ保存する手順を併記する。あわせて、実行時に使用した隔離export群を既存plan / execution logから記事へ追加するか、この節を「抜粋」に改題して完全な再現手順ではないことと、省略した設定が結果へ影響し得る制限を明記する。新しい実験は不要で、既存証拠だけで修正できる。

## Evidence trace

- Article `:36-57`のOS、architecture、exact versions、archive名、SHA-256、sandbox mode、checksum `OK`、help flagは`execution-log.md:5-33, 41-55, 58-66, 165-171`に対応し、raw evidenceとtarball hashのread-only照合でも一致した。
- Article `:85-110`のgate表、3コマンドのstdout、各commandのexit 0 / empty stderr、assertion exit 1、hard stopは`execution-log.md:39-66, 68-89`およびraw `.stdout` / `.stderr` / `.exit`に対応した。
- Article `:116-134`のfallback未実施、knowledge検索、原因未診断、未実行matrixと制限は`execution-log.md:91-116, 140-163, 173`に対応した。未観測のpackage-map挙動を結果として断定していない。
- 外部事実は2026-07-13時点の一次情報で確認した。Node.js v26.5.0 docsはpackage mapsをv26.4.0追加・Stability 1として説明し、JSONによるbare specifier解決、monorepoの明示的dependency、phantom dependency防止を記載する。pnpm v11.8.0 releaseは`node_modules/.package-map.json`生成と`standard` / `loose`設定追加を記載する。Article `:17-23, 57-59`と矛盾しない。
- 秘密情報や記事内の未redact absolute pathは見つからなかった。

## Suggestions

- なし。
