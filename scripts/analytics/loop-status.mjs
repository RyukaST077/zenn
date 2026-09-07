#!/usr/bin/env node
//
// Report the improvement loop as a funnel instead of a single number.
//
//   node scripts/analytics/loop-status.mjs          # human summary
//   node scripts/analytics/loop-status.mjs --json    # machine readable
//   node scripts/analytics/loop-status.mjs --strict  # exit 1 if a stall is detected
//
// Why this exists: next-arm.mjs fills the treatment arm from REGISTRATIONS,
// while EXP-001 reaches a verdict only from articles that were PUBLISHED and
// then measured at D30. Those are different counts, and nothing reported the
// gap. On 2026-09-08 all 12 registered contracts were unpublished and absent
// from the publication queue, while all 6 queued articles had no contract at
// all -- the two halves of the loop had no overlap, and the summary "12
// registered" hid it completely.
//
// The funnel also surfaces the orphan-contract hazard. run-article-pipeline-
// worktree.sh syncs artifacts back to the shared checkout regardless of the
// pipeline's exit code, and import-analytics hands the shared checkout's
// contracts to the next run's worktree. A run that registers an arm and then
// fails therefore leaves a contract that keeps consuming a treatment slot
// without ever producing an article. Such a contract is not tracked in git,
// which is what "reached main" means here, so it is reported separately.
//
// Exit codes: 0 ok / 1 stall detected under --strict / 2 misconfiguration

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { fail, parseArgs, readJson, readLedger } from "./zenn-metrics-lib.mjs";

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const policyPath = path.resolve(root, options.policy || "strategy/topic-selection-policy.json");
const ledgerPath = path.resolve(root, options.ledger || "analytics/article-ledger.jsonl");
const contractsDir = path.resolve(root, options.contracts || "analytics/contracts");
const queuePath = path.resolve(root, options.queue || "config/zenn-publish-queue.json");
const experimentsDir = path.resolve(root, options.experiments || "experiments");

const policy = readJson(policyPath, "policy");
const ledger = readLedger(ledgerPath);

const activeId = policy.activeExperiment ?? null;
const experiment = activeId
  ? readJson(path.join(experimentsDir, `${activeId}.json`), "experiment")
  : null;
const treatmentArm = experiment?.design?.treatment?.arm ?? null;
const treatmentTarget = experiment?.design?.treatment?.n ?? null;
const minimumObservationDays = experiment?.evaluation?.minimumObservationDays ?? 30;

// Being committed on the base branch is the only available proof that a
// contract reached main. Read it from that branch's tree rather than from the
// index: a shared checkout whose local branch has fallen behind still has every
// file on disk, and `git ls-files` would call all of them untracked. A checkout
// without git, or without the base ref, cannot answer the question and reports
// unknown rather than guessing either way.
const baseRefs = [options["base-ref"], "origin/main", "main", "HEAD"].filter(Boolean);
const gitTracked = (() => {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: root, encoding: "utf8",
  });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return null;
  for (const ref of baseRefs) {
    const listed = spawnSync(
      "git", ["ls-tree", "-r", "-z", "--name-only", ref, "--", "analytics/contracts"],
      { cwd: root, encoding: "utf8" },
    );
    if (listed.status !== 0) continue;
    return { ref, files: new Set(listed.stdout.split("\0").filter(Boolean)) };
  }
  return null;
})();

const queue = fs.existsSync(queuePath) ? readJson(queuePath, "publication queue") : null;
const slugOfArticle = (article) => path.basename(article).replace(/\.md$/, "");
const queuedSlugs = new Set((queue?.entries ?? []).map((entry) => slugOfArticle(entry.article)));
const blockedSlugs = new Set((queue?.blocked ?? []).map((entry) => slugOfArticle(entry.article)));

const publishedFlag = (slug) => {
  const file = path.join(root, "articles", `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return /^published:\s*true\s*$/m.test(fs.readFileSync(file, "utf8"));
};

const ledgerBySlug = new Map(ledger.filter((entry) => entry.slug).map((entry) => [entry.slug, entry]));

// A D30 reading restated from a much older article is an upper bound, not a
// measurement at day 30, so it is counted separately rather than folded in.
const d30State = (slug) => {
  const observation = ledgerBySlug.get(slug)?.observations?.d30;
  if (!observation) return "none";
  return observation.basis === "current-upper-bound" ? "upper-bound" : "measured";
};

const contracts = [];
if (fs.existsSync(contractsDir)) {
  for (const name of fs.readdirSync(contractsDir).sort()) {
    if (!name.endsWith(".json")) continue;
    const relative = path.posix.join("analytics/contracts", name);
    const contract = readJson(path.join(contractsDir, name), `contract ${name}`);
    if (!contract.slug) fail(`${relative} has no slug`);
    const published = publishedFlag(contract.slug);
    contracts.push({
      slug: contract.slug,
      relative,
      arm: contract.classification?.arm ?? null,
      experimentId: contract.classification?.experimentId ?? null,
      reachedMain: gitTracked === null ? null : gitTracked.files.has(relative),
      articleExists: published !== null,
      queued: queuedSlugs.has(contract.slug),
      blocked: blockedSlugs.has(contract.slug),
      published: published === true,
      d30: d30State(contract.slug),
    });
  }
}

const funnelOf = (rows) => ({
  registered: rows.length,
  articleWritten: rows.filter((row) => row.articleExists).length,
  queued: rows.filter((row) => row.queued).length,
  published: rows.filter((row) => row.published).length,
  d30Measured: rows.filter((row) => row.d30 === "measured").length,
});

const treatment = treatmentArm
  ? contracts.filter((row) => row.arm === treatmentArm && row.experimentId === activeId)
  : [];
const treatmentFunnel = funnelOf(treatment);

// Two stalls are worth failing on, because both let the loop report progress
// while the verdict moves no closer.
const orphans = contracts.filter((row) => row.reachedMain === false || !row.articleExists);
const stalls = [];
if (orphans.length > 0) {
  stalls.push(
    `${orphans.length} contract(s) consume an arm slot without an article that reached main: `
    + orphans.map((row) => row.slug).join(", "),
  );
}
if (treatmentTarget !== null
  && treatmentFunnel.registered >= treatmentTarget
  && treatmentFunnel.published < treatmentTarget) {
  stalls.push(
    `${treatmentArm} is fully registered (${treatmentFunnel.registered}/${treatmentTarget}) but only `
    + `${treatmentFunnel.published} article(s) are published, so allocation has stopped before the `
    + `experiment can be measured`,
  );
}

const report = {
  activeExperiment: activeId,
  treatmentArm,
  treatmentTarget,
  minimumObservationDays,
  baseRef: gitTracked?.ref ?? "unknown",
  treatment: treatmentFunnel,
  allContracts: funnelOf(contracts),
  byArm: Object.fromEntries(
    [...new Set(contracts.map((row) => row.arm ?? "unspecified"))].sort()
      .map((arm) => [arm, funnelOf(contracts.filter((row) => (row.arm ?? "unspecified") === arm))]),
  ),
  queue: queue
    ? {
      pending: queue.entries?.length ?? 0,
      blocked: queue.blocked?.length ?? 0,
      // A queued article with no contract cannot advance any arm, which is how
      // the queue and the experiment drifted apart.
      pendingWithoutContract: (queue.entries ?? [])
        .map((entry) => slugOfArticle(entry.article))
        .filter((slug) => !contracts.some((row) => row.slug === slug)).length,
    }
    : null,
  orphanContracts: orphans.map((row) => ({
    slug: row.slug, reachedMain: row.reachedMain, articleExists: row.articleExists,
  })),
  stalls,
};

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const line = (label, funnel) => console.log(
    `  ${label.padEnd(18)}登録 ${String(funnel.registered).padStart(3)}`
    + ` → 記事 ${String(funnel.articleWritten).padStart(3)}`
    + ` → キュー ${String(funnel.queued).padStart(3)}`
    + ` → 公開 ${String(funnel.published).padStart(3)}`
    + ` → D30実測 ${String(funnel.d30Measured).padStart(3)}`,
  );
  console.log(`experiment: ${activeId ?? "none"} (treatment ${treatmentArm ?? "-"}, target ${treatmentTarget ?? "-"})`);
  line(treatmentArm ?? "treatment", treatmentFunnel);
  console.log("arm 別:");
  for (const [arm, funnel] of Object.entries(report.byArm)) line(arm, funnel);
  if (report.queue) {
    console.log(`queue: ${report.queue.pending} pending / ${report.queue.blocked} blocked`
      + ` / ${report.queue.pendingWithoutContract} pending without a contract`);
  }
  if (gitTracked === null) {
    console.log("note: no base ref available, so \"reached main\" could not be checked");
  }
  if (stalls.length === 0) {
    console.log("stalls: none");
  } else {
    for (const stall of stalls) console.log(`STALL: ${stall}`);
  }
}

if (options.strict && stalls.length > 0) process.exit(1);
