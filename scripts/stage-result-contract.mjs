#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const slugPattern = "^[a-z0-9-]{12,50}$";
const stages = new Set(["search", "plan", "run", "draft", "review", "revise", "prepare_publish"]);

export function contractFor(stage) {
  if (!stages.has(stage)) throw new Error(`unknown stage: ${stage}`);
  return {
    verdict: stage === "review" ? "required" : "null",
    slug: ["draft", "review", "revise", "prepare_publish"].includes(stage) ? "required" : "null",
    prMetadata: stage === "prepare_publish" ? "required" : "null",
  };
}

const nullableString = (pattern) => ({
  type: ["string", "null"],
  ...(pattern ? { pattern } : {}),
});

export function schemaFor(stage) {
  const contract = contractFor(stage);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      status: { type: "string", enum: ["ok", "abort"] },
      artifact: { type: "string" },
      reason: { type: "string" },
      metadata: {
        type: "object",
        properties: {
          verdict: contract.verdict === "null"
            ? { type: "null" }
            : { type: ["string", "null"], enum: ["pass", "fix", "blocker", null] },
          slug: contract.slug === "null" ? { type: "null" } : nullableString(slugPattern),
          pr_metadata: contract.prMetadata === "null" ? { type: "null" } : nullableString(),
        },
        required: ["verdict", "slug", "pr_metadata"],
        additionalProperties: false,
      },
    },
    required: ["status", "artifact", "reason", "metadata"],
    additionalProperties: false,
  };
}

export function promptFor(stage) {
  const contract = contractFor(stage);
  const verdict = contract.verdict === "required"
    ? 'metadata.verdict must be "pass", "fix", or "blocker"'
    : "metadata.verdict must be null";
  const slug = contract.slug === "required"
    ? "metadata.slug must be the valid article slug"
    : "metadata.slug must be null";
  const prMetadata = contract.prMetadata === "required"
    ? "metadata.pr_metadata must be the repository-relative PR metadata path"
    : "metadata.pr_metadata must be null";
  return `For a successful ${stage} result, ${verdict}; ${slug}; and ${prMetadata}. For an aborted result, all three metadata values must be null.`;
}

export function metadataError(stage, metadata, artifact) {
  const contract = contractFor(stage);
  if (contract.verdict === "required" && !["pass", "fix", "blocker"].includes(metadata.verdict)) {
    return "review result requires a verdict";
  }
  if (contract.verdict === "null" && metadata.verdict !== null) {
    return "only review may set metadata.verdict";
  }
  if (contract.slug === "null" && metadata.slug !== null) {
    return `${stage} must leave metadata.slug null`;
  }
  if (contract.slug === "required" && !new RegExp(slugPattern).test(metadata.slug || "")) {
    return `${stage} requires a valid slug`;
  }
  if (["draft", "revise", "prepare_publish"].includes(stage)
      && path.basename(artifact, ".md") !== metadata.slug) {
    return "artifact filename and metadata.slug differ";
  }
  if (contract.prMetadata === "required" && typeof metadata.pr_metadata !== "string") {
    return "prepare_publish requires metadata.pr_metadata";
  }
  if (contract.prMetadata === "null" && metadata.pr_metadata !== null) {
    return "only prepare_publish may set metadata.pr_metadata";
  }
  return null;
}

export function normalizeForbiddenMetadata(stage, result) {
  const contract = contractFor(stage);
  if (!result || typeof result !== "object" || !result.metadata || typeof result.metadata !== "object") {
    throw new Error("stage result metadata is missing");
  }
  const changes = [];
  const setNull = (key) => {
    if (result.metadata[key] !== null) {
      result.metadata[key] = null;
      changes.push(`metadata.${key}`);
    }
  };
  if (result.status === "abort" || contract.verdict === "null") setNull("verdict");
  if (result.status === "abort" || contract.slug === "null") setNull("slug");
  if (result.status === "abort" || contract.prMetadata === "null") setNull("pr_metadata");
  return changes;
}

function usage() {
  throw new Error("usage: stage-result-contract.mjs schema STAGE OUTPUT | prompt STAGE | normalize STAGE RESULT");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [command, stage, target] = process.argv.slice(2);
    if (command === "schema" && target) {
      fs.writeFileSync(target, `${JSON.stringify(schemaFor(stage), null, 2)}\n`);
    } else if (command === "prompt" && stage && !target) {
      process.stdout.write(promptFor(stage));
    } else if (command === "normalize" && target) {
      const result = JSON.parse(fs.readFileSync(target, "utf8"));
      const changes = normalizeForbiddenMetadata(stage, result);
      if (changes.length > 0) fs.writeFileSync(target, `${JSON.stringify(result)}\n`);
      process.stdout.write(changes.join(","));
    } else {
      usage();
    }
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
