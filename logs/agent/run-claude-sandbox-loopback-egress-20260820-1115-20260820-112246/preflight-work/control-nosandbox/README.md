# claude-sandbox-loopback-egress fixture

Purpose: measure whether a sandboxed Claude Code Bash command can open a TCP
connection to a listener on the same host's loopback address when
`sandbox.network.allowedDomains` lists the loopback notations.

Files (all protected; the model must not change any of them):

- `claude-sandbox-loopback-wrapper.mjs` — manifest-selected launch adapter. Hosts
  the loopback listener outside the sandbox, injects one inline sandbox profile
  through the CLI `--settings` source, runs one non-interactive case, and writes
  `case-result.json`.
- `preflight-claude.mjs` — offline fake CLI for the runner's preflight. No
  provider, authentication, model, or paid request; no network module import.
- `probe.mjs` — the sandboxed command under test. One HTTP GET pinned to the
  `127.0.0.1` literal; it refuses any non-loopback target and never resolves a
  name, so it cannot reach an external host.
- `verify.mjs` — deterministic verifier. Accepts only pre-registered
  observations and writes the case completion marker.

Generated at run time (never stored here): `case-result.json`,
`verification.txt`. The adapter's normalized workspace, its `target.json`, and
`probe.json` live in a sibling directory that is removed before the runner
diffs the case tree.

Requirements: Node.js and an already-authenticated Claude Code CLI at
`2.1.236 (Claude Code)`. No dependency installation, external service, secret,
symlink, daemon, browser login, or production state.
