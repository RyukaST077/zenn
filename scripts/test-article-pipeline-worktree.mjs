#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const runner = path.join(repositoryRoot, "scripts/run-article-pipeline-worktree.sh");
const helper = path.join(repositoryRoot, "scripts/isolated-artifacts.mjs");
const safeSync = path.join(repositoryRoot, "scripts/safe-sync-main.sh");
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-pipeline-worktree-test-"));
const checkout = path.join(testRoot, "checkout");
const remote = path.join(testRoot, "remote.git");

const run = (cwd, command, args, env = {}) => spawnSync(command, args, {
  cwd,
  encoding: "utf8",
  env: { ...process.env, ...env },
});
const assertRun = (result, label) => assert.equal(
  result.status,
  0,
  `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
);

try {
  fs.mkdirSync(path.join(checkout, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
  assertRun(run(checkout, "git", ["init", "-b", "main"]), "git init");
  assertRun(run(checkout, "git", ["config", "user.name", "Worktree Test"]), "git user.name");
  assertRun(run(checkout, "git", ["config", "user.email", "worktree@example.com"]), "git user.email");
  fs.copyFileSync(helper, path.join(checkout, "scripts/isolated-artifacts.mjs"));
  fs.copyFileSync(safeSync, path.join(checkout, "scripts/safe-sync-main.sh"));
  fs.writeFileSync(path.join(checkout, "README.md"), "# remote baseline\n");
  fs.writeFileSync(path.join(checkout, "articles/baseline.md"), "remote article\n");
  fs.writeFileSync(path.join(checkout, "scripts/fake-pipeline.sh"), `#!/usr/bin/env bash
set -euo pipefail
[ "\${ARTICLE_PIPELINE_ISOLATED_WORKTREE:-0}" = 1 ]
[ "\${ARTICLE_PIPELINE_SHARED_ROOT:-}" = "${checkout}" ]
[ -z "$(git branch --show-current)" ]
[ "$(pwd)" != "${checkout}" ]
bash scripts/safe-sync-main.sh main
case "\${1:-}" in
  collision)
    mkdir -p articles
    printf 'isolated value\\n' > articles/collision.md
    ;;
  resume)
    [ -f logs/pipeline-resume/state.json ]
    printf '{"step":2}\\n' > logs/pipeline-resume/state.json
    ;;
  *)
    mkdir -p research logs/pipeline-fixture
    printf 'generated evidence\\n' > research/generated.md
    printf '{"ok":true}\\n' > logs/pipeline-fixture/state.json
    ;;
esac
`, { mode: 0o755 });
  assertRun(run(checkout, "git", ["add", "."]), "git add");
  assertRun(run(checkout, "git", ["commit", "-m", "fixture"]), "git commit");
  assertRun(run(testRoot, "git", ["init", "--bare", remote]), "bare remote");
  assertRun(run(checkout, "git", ["remote", "add", "origin", remote]), "remote add");
  assertRun(run(checkout, "git", ["push", "-u", "origin", "main"]), "push main");

  fs.writeFileSync(path.join(checkout, "README.md"), "# dirty shared checkout\n");
  fs.writeFileSync(path.join(checkout, "local-untracked.txt"), "keep me\n");
  const headBefore = run(checkout, "git", ["rev-parse", "HEAD"]).stdout.trim();
  const statusBefore = run(checkout, "git", ["status", "--porcelain", "--untracked-files=all"]).stdout;
  const successful = run(checkout, "bash", [
    runner, "--shared-root", checkout, "--", "scripts/fake-pipeline.sh",
  ]);
  assertRun(successful, "isolated pipeline run");
  assert.equal(fs.readFileSync(path.join(checkout, "README.md"), "utf8"), "# dirty shared checkout\n");
  assert.equal(fs.readFileSync(path.join(checkout, "local-untracked.txt"), "utf8"), "keep me\n");
  assert.equal(fs.readFileSync(path.join(checkout, "research/generated.md"), "utf8"), "generated evidence\n");
  assert.equal(run(checkout, "git", ["rev-parse", "HEAD"]).stdout.trim(), headBefore);
  assert.equal(run(checkout, "git", ["status", "--porcelain", "--untracked-files=all"]).stdout,
    `${statusBefore}?? logs/pipeline-fixture/state.json\n?? research/generated.md\n`);
  const worktreesAfterSuccess = run(checkout, "git", ["worktree", "list", "--porcelain"]);
  assert.equal((worktreesAfterSuccess.stdout.match(/^worktree /gm) || []).length, 1,
    `successful run leaked a worktree:\n${worktreesAfterSuccess.stdout}`);

  fs.mkdirSync(path.join(checkout, "logs/pipeline-resume"), { recursive: true });
  fs.writeFileSync(path.join(checkout, "logs/pipeline-resume/state.json"), '{"step":1}\n');
  const resumed = run(checkout, "bash", [
    runner, "--shared-root", checkout, "--", "scripts/fake-pipeline.sh",
    "resume", "--resume", "logs/pipeline-resume",
  ]);
  assertRun(resumed, "isolated resume run");
  assert.equal(fs.readFileSync(path.join(checkout, "logs/pipeline-resume/state.json"), "utf8"), '{"step":2}\n');

  fs.writeFileSync(path.join(checkout, "articles/collision.md"), "local evidence\n");
  const collision = run(checkout, "bash", [
    runner, "--shared-root", checkout, "--", "scripts/fake-pipeline.sh", "collision",
  ]);
  assert.equal(collision.status, 3, `collision run returned ${collision.status}\n${collision.stderr}`);
  assert.match(collision.stderr, /COLLISION: articles\/collision\.md/);
  assert.equal(fs.readFileSync(path.join(checkout, "articles/collision.md"), "utf8"), "local evidence\n");
  const preservedMatch = collision.stderr.match(/preserved after artifact collision: (.+)\n/);
  assert.ok(preservedMatch, `preserved worktree path missing:\n${collision.stderr}`);
  const preserved = preservedMatch[1];
  assert.equal(fs.readFileSync(path.join(preserved, "articles/collision.md"), "utf8"), "isolated value\n");
  assertRun(run(checkout, "git", ["worktree", "remove", "--force", preserved]), "remove preserved worktree");
  fs.rmSync(path.dirname(preserved), { recursive: true, force: true });

  console.log("article pipeline worktree tests passed");
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
