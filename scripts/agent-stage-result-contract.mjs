#!/usr/bin/env node

import fs from "node:fs";

const slugPattern = "^[a-z0-9-]{12,50}$";
const stages = new Set(["search", "plan", "run", "analyze", "draft", "review", "revise"]);
const analysisVerdicts = ["confirmed", "conditional", "not-reproduced", "unsupported", "inconclusive"];
const analysisActions = ["draft", "rerun", "stop"];
const reviewVerdicts = ["pass", "fix", "rerun", "blocker"];

export function contractFor(stage) {
  if (!stages.has(stage)) throw new Error(`unknown agent stage: ${stage}`);
  return {
    verdict: stage === "analyze" ? analysisVerdicts : (stage === "review" ? reviewVerdicts : null),
    action: stage === "analyze" ? analysisActions : null,
    slug: ["draft", "review", "revise"].includes(stage),
  };
}

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
          verdict: contract.verdict
            ? { type: ["string", "null"], enum: [...contract.verdict, null] }
            : { type: "null" },
          action: contract.action
            ? { type: ["string", "null"], enum: [...contract.action, null] }
            : { type: "null" },
          slug: contract.slug
            ? { type: ["string", "null"], pattern: slugPattern }
            : { type: "null" },
        },
        required: ["verdict", "action", "slug"],
        additionalProperties: false,
      },
    },
    required: ["status", "artifact", "reason", "metadata"],
    additionalProperties: false,
  };
}

export function promptFor(stage) {
  const contract = contractFor(stage);
  const parts = [
    contract.verdict
      ? `metadata.verdict must be one of ${contract.verdict.map((value) => `"${value}"`).join(", ")}`
      : "metadata.verdict must be null",
    contract.action
      ? `metadata.action must be one of ${contract.action.map((value) => `"${value}"`).join(", ")}`
      : "metadata.action must be null",
    contract.slug ? "metadata.slug must be the article slug" : "metadata.slug must be null",
  ];
  return `For a successful ${stage} result, ${parts.join("; ")}. For an aborted result, all metadata values must be null.`;
}

export function metadataError(stage, metadata, artifact) {
  const contract = contractFor(stage);
  if (contract.verdict ? !contract.verdict.includes(metadata.verdict) : metadata.verdict !== null) {
    return `${stage} has an invalid metadata.verdict`;
  }
  if (contract.action ? !contract.action.includes(metadata.action) : metadata.action !== null) {
    return `${stage} has an invalid metadata.action`;
  }
  if (contract.slug) {
    if (!new RegExp(slugPattern).test(metadata.slug || "")) return `${stage} requires a valid slug`;
  } else if (metadata.slug !== null) {
    return `${stage} must leave metadata.slug null`;
  }
  if (["draft", "revise"].includes(stage) && artifact.split("/").at(-1) !== `${metadata.slug}.md`) {
    return "article filename and metadata.slug differ";
  }
  return null;
}

function usage() {
  throw new Error("usage: agent-stage-result-contract.mjs schema STAGE OUTPUT | prompt STAGE");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [command, stage, target] = process.argv.slice(2);
    if (command === "schema" && target) {
      fs.writeFileSync(target, `${JSON.stringify(schemaFor(stage), null, 2)}\n`);
    } else if (command === "prompt" && stage && !target) {
      process.stdout.write(promptFor(stage));
    } else {
      usage();
    }
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
