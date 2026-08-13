# Manifest contract

Create JSON with exactly these top-level fields:

```json
{
  "version": 1,
  "id": "lowercase-hyphen-id",
  "topic": "short human-readable topic",
  "claim": "falsifiable claim",
  "mode": "smoke|recipe|ablation|boundary|workflow|failure|comparison",
  "source_report": "research/agent/agent-knowhow-....md",
  "plan": "practice/agent/agent-practice-....md",
  "fixture": "fixtures/agent-practice/<fixture>",
  "prompt": "non-interactive task prompt",
  "timeout_seconds": 300,
  "network": false,
  "cases": [
    {
      "id": "unique-case-id",
      "provider": "claude|codex",
      "guidance": null,
      "model": null,
      "effort": null,
      "expected_marker": null
    }
  ],
  "verification": {
    "command": ["node", "test.mjs"],
    "marker_file": "verification.txt",
    "protected_paths": ["test.mjs", "package.json"],
    "allowed_changes": ["src/greet.js", "verification.txt"]
  }
}
```

`guidance`, `model`, `effort`, and `expected_marker` may be strings or null. A guidance path must be under `fixtures/agent-practice/guidance/`. Use only repository-relative paths without `..`. Use at most eight cases and a timeout from 10 to 1800 seconds.

`network` maps to Codex `sandbox_workspace_write.network_access`. The current runner invokes Claude directly on the host, so the same field does not enforce Claude network isolation. A mixed-provider plan must state this asymmetry and must not describe `network: false` as an all-case security boundary.

Prefer an existing fixture. When the selected claim requires a new fixture, create it under `fixtures/agent-practice/<topic>/` before validating the manifest. Keep it self-contained, deterministic, offline, free of secrets and symlinks, and executable with runtimes already available in the repository environment. Put optional product-root guidance below `fixtures/agent-practice/guidance/<topic>/claude/CLAUDE.md` or `fixtures/agent-practice/guidance/<topic>/codex/AGENTS.md`; the runner copies the selected file to the case root. Do not run the experiment during the plan stage.
