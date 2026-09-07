#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scriptDir, "validate-agent-generated-paths.mjs");
const artifactTool = path.join(scriptDir, "isolated-artifacts.mjs");
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-agent-artifact-test-"));
const checkout = path.join(testRoot, "checkout");
const shared = path.join(testRoot, "shared");
const snapshot = path.join(testRoot, "shared.json");
const baseline = path.join(testRoot, "baseline.json");

const run = (cwd, command, args) => spawnSync(command, args, { cwd, encoding: "utf8" });
const expectStatus = (result, status, label) => assert.equal(
  result.status,
  status,
  `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
);
const writeFixture = (root, name, content) => {
  const directory = path.join(root, "fixtures/agent-practice", name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "verify.mjs"), content);
};
const writeManifest = (name, id, fixture, guidance = null) => {
  const file = path.join(testRoot, `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify({
    id,
    fixture,
    cases: guidance ? [{ guidance }] : [],
  })}\n`);
  return file;
};

try {
  fs.mkdirSync(checkout, { recursive: true });
  fs.mkdirSync(shared, { recursive: true });
  expectStatus(run(checkout, "git", ["init", "-b", "main"]), 0, "git init");
  expectStatus(run(checkout, "git", ["config", "user.name", "Artifact Test"]), 0, "git user.name");
  expectStatus(run(checkout, "git", ["config", "user.email", "artifact@example.com"]), 0, "git user.email");

  writeFixture(checkout, "tracked-fixture", "tracked\n");
  writeFixture(shared, "tracked-fixture", "tracked\n");
  expectStatus(run(checkout, "git", ["add", "."]), 0, "git add fixture");
  expectStatus(run(checkout, "git", ["commit", "-m", "tracked fixture"]), 0, "git commit fixture");
  expectStatus(run(checkout, "node", [artifactTool, "snapshot", shared, snapshot]), 0, "snapshot shared");

  const trackedManifest = writeManifest(
    "tracked",
    "tracked-manifest",
    "fixtures/agent-practice/tracked-fixture",
  );
  expectStatus(run(checkout, "node", [validator, trackedManifest, snapshot]), 0, "exact tracked reuse");
  fs.writeFileSync(path.join(checkout, "fixtures/agent-practice/tracked-fixture/verify.mjs"), "modified\n");
  expectStatus(run(checkout, "node", [validator, trackedManifest, snapshot]), 2, "modified tracked reuse");
  fs.writeFileSync(path.join(checkout, "fixtures/agent-practice/tracked-fixture/verify.mjs"), "tracked\n");

  const uniqueId = "new-fixture-20260827-2010";
  writeFixture(checkout, uniqueId, "new\n");
  const uniqueGuidance = `fixtures/agent-practice/guidance/${uniqueId}/CLAUDE.md`;
  fs.mkdirSync(path.dirname(path.join(checkout, uniqueGuidance)), { recursive: true });
  fs.writeFileSync(path.join(checkout, uniqueGuidance), "unique guidance\n");
  const uniqueManifest = writeManifest("unique", uniqueId, `fixtures/agent-practice/${uniqueId}`, uniqueGuidance);
  expectStatus(run(checkout, "node", [validator, uniqueManifest, snapshot]), 0, "unique untracked fixture");

  const genericGuidance = "fixtures/agent-practice/guidance/shared-name/CLAUDE.md";
  fs.mkdirSync(path.dirname(path.join(checkout, genericGuidance)), { recursive: true });
  fs.writeFileSync(path.join(checkout, genericGuidance), "generic guidance\n");
  const guidanceId = "guidance-fixture-20260827-2012";
  writeFixture(checkout, guidanceId, "guidance fixture\n");
  const guidanceManifest = writeManifest(
    "guidance",
    guidanceId,
    `fixtures/agent-practice/${guidanceId}`,
    genericGuidance,
  );
  expectStatus(run(checkout, "node", [validator, guidanceManifest, snapshot]), 2,
    "unnamespaced untracked guidance");

  writeFixture(checkout, "generic-fixture", "new generic\n");
  const genericManifest = writeManifest(
    "generic",
    "generic-fixture",
    "fixtures/agent-practice/generic-fixture",
  );
  expectStatus(run(checkout, "node", [validator, genericManifest, snapshot]), 2, "generic untracked fixture");

  writeFixture(checkout, "shared-collision", "new collision\n");
  writeFixture(shared, "shared-collision", "old collision\n");
  expectStatus(run(checkout, "node", [artifactTool, "snapshot", shared, snapshot]), 0, "refresh shared snapshot");
  const collisionManifest = writeManifest(
    "collision",
    "shared-collision-20260827-2011",
    "fixtures/agent-practice/shared-collision",
  );
  const pathCollision = run(checkout, "node", [validator, collisionManifest, snapshot]);
  expectStatus(pathCollision, 2, "shared fixture collision");
  assert.match(pathCollision.stderr, /artifact path collision/);

  fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
  expectStatus(run(checkout, "node", [artifactTool, "snapshot", checkout, baseline]), 0, "snapshot export baseline");
  fs.writeFileSync(path.join(checkout, "articles/collision.md"), "isolated\n");
  fs.mkdirSync(path.join(shared, "articles"), { recursive: true });
  fs.writeFileSync(path.join(shared, "articles/collision.md"), "shared\n");
  const syncCollision = run(checkout, "node", [artifactTool, "check-sync", checkout, shared, baseline]);
  expectStatus(syncCollision, 3, "check-sync collision");
  assert.equal(fs.readFileSync(path.join(shared, "articles/collision.md"), "utf8"), "shared\n");
  fs.unlinkSync(path.join(shared, "articles/collision.md"));
  expectStatus(run(checkout, "node", [artifactTool, "check-sync", checkout, shared, baseline]), 0,
    "check-sync without collision");

  // The daily improvement loop rewrites the ledger, the market index and the
  // observation report in the shared checkout every morning, and a pipeline run
  // can outlive that hour. If those files were exported, both sides editing them
  // would be a collision and the whole run's artifacts would be discarded. The
  // registrations ride back in analytics/contracts/ instead, one file per slug.
  fs.mkdirSync(path.join(checkout, "analytics/contracts"), { recursive: true });
  fs.mkdirSync(path.join(shared, "analytics"), { recursive: true });
  expectStatus(run(checkout, "node", [artifactTool, "snapshot", checkout, baseline]), 0,
    "snapshot analytics baseline");
  for (const derived of ["article-ledger.jsonl", "market-index.json", "topic-feedback.md"]) {
    fs.writeFileSync(path.join(checkout, "analytics", derived), "isolated\n");
    fs.writeFileSync(path.join(shared, "analytics", derived), "shared\n");
  }
  fs.writeFileSync(path.join(checkout, "analytics/contracts/registered.json"), "{}\n");
  expectStatus(run(checkout, "node", [artifactTool, "sync", checkout, shared, baseline]), 0,
    "derived analytics files must not collide");
  for (const derived of ["article-ledger.jsonl", "market-index.json", "topic-feedback.md"]) {
    assert.equal(
      fs.readFileSync(path.join(shared, "analytics", derived), "utf8"), "shared\n",
      `the shared ${derived} must be left to the daily loop`,
    );
  }
  assert.equal(
    fs.readFileSync(path.join(shared, "analytics/contracts/registered.json"), "utf8"), "{}\n",
    "a registration must still reach the shared checkout",
  );

  // The same three files must still travel the other way. The committed copies
  // are only as fresh as the last commit of analytics/, while the shared
  // checkout is rewritten every morning, so every run -- not just a resumed one
  // -- is handed the shared copies before it allocates an arm. GA4 traffic and
  // the raw snapshots stay behind.
  const loopInputs = path.join(testRoot, "loop-inputs");
  fs.mkdirSync(path.join(loopInputs, "shared/analytics/contracts"), { recursive: true });
  fs.mkdirSync(path.join(loopInputs, "shared/analytics/private"), { recursive: true });
  fs.mkdirSync(path.join(loopInputs, "shared/analytics/raw"), { recursive: true });
  fs.mkdirSync(path.join(loopInputs, "worktree"), { recursive: true });
  fs.writeFileSync(path.join(loopInputs, "shared/analytics/article-ledger.jsonl"), "fresh\n");
  fs.writeFileSync(path.join(loopInputs, "shared/analytics/market-index.json"), "fresh\n");
  fs.writeFileSync(path.join(loopInputs, "shared/analytics/topic-feedback.md"), "fresh\n");
  fs.writeFileSync(path.join(loopInputs, "shared/analytics/contracts/a.json"), "{}\n");
  fs.writeFileSync(path.join(loopInputs, "shared/analytics/private/ga4-ledger.jsonl"), "traffic\n");
  fs.writeFileSync(path.join(loopInputs, "shared/analytics/raw/self.json"), "raw\n");
  expectStatus(
    run(checkout, "node", [artifactTool, "import-analytics",
      path.join(loopInputs, "shared"), path.join(loopInputs, "worktree")]),
    0, "import loop inputs",
  );
  for (const handed of ["article-ledger.jsonl", "market-index.json", "topic-feedback.md", "contracts/a.json"]) {
    assert.equal(
      fs.readFileSync(path.join(loopInputs, "worktree/analytics", handed), "utf8").trim(),
      handed.startsWith("contracts") ? "{}" : "fresh",
      `${handed} must be handed to the worktree`,
    );
  }
  for (const withheld of ["private/ga4-ledger.jsonl", "raw/self.json"]) {
    assert.equal(
      fs.existsSync(path.join(loopInputs, "worktree/analytics", withheld)), false,
      `${withheld} must never enter a worktree`,
    );
  }

  console.log("agent artifact collision tests passed");
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
