# Review: chrome150-focusgroup-property-gate

verdict: fix
blockers: 0
warnings: 1

## Scope

- Article: `articles/chrome150-focusgroup-property-gate.md`
- Execution log: `logs/run-focusgroup-chrome150-20260713-103650/execution-log.md`
- Reviewed: 2026-07-13 10:46 JST
- Deterministic check: `bash scripts/check-article.sh articles/chrome150-focusgroup-property-gate.md --expect-published false` passed with slug `chrome150-focusgroup-property-gate` and `published=false`.

The article and execution log match. The recorded environment, Chrome for Testing version, successful launch/navigation, observed `focusgroupPropertySupport: false`, gate exit-code distinction, immediate stop, and every `not-run` boundary are supported by the execution log and its referenced evidence. The article does not infer keyboard or accessibility results after the failed gate.

## Findings

### Warning 1: the reproduction sequence omits prerequisites required by its own commands

- Article location: lines 52-104, especially lines 69-75 and 90-103.
- Issue: The section is labeled `再現手順`, but it does not tell the reader to enter a new run-local `work/` directory or create the run-local `package.json` that pins `playwright-core` 1.61.1. It also says the downloaded browser version was checked while the shown block only downloads and queries the manifest; it omits the archive download, unzip, executable assignment/version command, localhost server startup, and `BASE_URL` assignment. Consequently, `npm install` can run against the repository root and the later example references undefined `CFT_EXECUTABLE` and `BASE_URL`. The displayed sequence is not independently reproducible as written.
- Required change: Either (a) add the missing isolation/package/browser/server setup commands so the sequence can be run from the repository root, or (b) explicitly state that the snippets are selected excerpts rather than a complete reproduction procedure and direct readers to the preserved execution log/practice plan for the complete ordered commands. Also change the sentence at line 75 so it claims only what the displayed block performs, unless the omitted download and `"$CFT_EXECUTABLE" --version` steps are added.
- Existing evidence permitting the change: execution log sections `Chronological commands` and `Reproducibility notes`; `practice/practice-focusgroup-chrome150-20260713-1033.md` steps 1-4; `work/package.json`; `work/evidence/browser-cli-version.txt`; `work/evidence/server-url.txt`. No new experiment is needed.

## Suggestions

### Suggestion 1: prefer the current primary feature-detection source

- Article location: lines 106 and 194.
- The cited Jeremy Keith article supports property-based detection, but Chrome's primary `Request for developer feedback: focusgroup` page gives the exact expression `'focusgroup' in HTMLElement.prototype`. Replacing or supplementing the secondary citation would make the gate contract easier to verify against the implementation proposal.

### Suggestion 2: identify the directory tree as abbreviated

- Article location: lines 54-67.
- The tree omits run-local files and directories such as `package.json`, `package-lock.json`, `node_modules/`, and `shots/`. Add an ellipsis or call it a relevant-files excerpt so readers do not interpret it as a complete inventory. The complete evidence inventory is recorded in `work/evidence/file-list.txt`.

## External-source verification

- Chrome for Developers, `New in Chrome 150`, supports the description of declarative arrow navigation, a tab stop, and last-focused memory.
- W3C APG, `Developing a Keyboard Interface`, supports treating a composite as one Tab-sequence stop and using other keys for internal focus movement.
- The preserved official Chrome for Testing manifest and `work/evidence/cft-stable.tsv` support the selected Stable version and platform; the article correctly notes that the live manifest changes.
- Chrome for Developers' focusgroup RFC supports the exact property-based feature-detection expression and the distinction between focus navigation and author-managed selection.
- The linked Open UI explainer supports the focus/selection responsibility distinction, though the current scoped explainer or Chrome RFC would be a more direct source for the shipped proposal.

