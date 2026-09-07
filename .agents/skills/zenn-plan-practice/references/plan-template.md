# Practice plan contract

Include: source report; objective; hypothesis; environment; prerequisites; isolation directory; ordered steps and commands; observations to capture; success/failure criteria; security and cost limits; cleanup; timebox; fallback scope; expected article takeaways. Commands must be non-interactive.

When applicable, also include:

- documented product-specific telemetry, preference, update-check, cache, and browser-state controls applied before the first relevant command;
- an explicit prohibition on changing `HOME` or `CODEX_HOME`;
- a capability gate for browsers, containers, downloaded runtimes, and background processes;
- pinned CLI `--help` evidence and exact start/status/log/stop subcommand syntax before lifecycle-managed server tests;
- a pre/post assertion for known external state that the selected tool may otherwise mutate, while treating the `workspace-write` sandbox as the actual broad write boundary.
