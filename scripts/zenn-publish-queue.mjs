#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_QUEUE = "config/zenn-publish-queue.json";
// Zenn can accept a deployment yet keep the article unreachable (HTTP 403).
// Such an entry never becomes visible in the public API, so the queue head has
// to give up after a bounded number of attempts instead of blocking forever.
const DEFAULT_MAX_ATTEMPTS = 3;

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(2);
};

const parseArgs = (argv) => {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) fail(`${value} requires a value`);
    options[key] = next;
    index += 1;
  }
  return { positional, options };
};

const { positional, options } = parseArgs(process.argv.slice(2));
const command = positional.shift();
const root = path.resolve(options.root || process.cwd());
const queuePath = path.resolve(root, options.queue || DEFAULT_QUEUE);

const parseDate = (value, label) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(`${label} is not a valid date: ${value}`);
  return date;
};

const readQueue = () => {
  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
  } catch (error) {
    fail(`cannot read queue ${path.relative(root, queuePath)}: ${error.message}`);
  }
  if (queue.version !== 1) fail("queue version must be 1");
  if (!/^[a-zA-Z0-9_-]+$/.test(queue.zennUsername || "")) fail("zennUsername is invalid");
  if (!Number.isInteger(queue.maxPublicationsPer24Hours)
      || queue.maxPublicationsPer24Hours < 1) {
    fail("maxPublicationsPer24Hours must be a positive integer");
  }
  if (!Number.isInteger(queue.retryAfterHours) || queue.retryAfterHours < 1) {
    fail("retryAfterHours must be a positive integer");
  }
  if (queue.maxAttempts !== undefined
      && (!Number.isInteger(queue.maxAttempts) || queue.maxAttempts < 1)) {
    fail("maxAttempts must be a positive integer");
  }
  if (queue.blocked !== undefined && !Array.isArray(queue.blocked)) {
    fail("blocked must be an array");
  }
  if (!Array.isArray(queue.entries)) fail("entries must be an array");

  const seen = new Set();
  for (const [index, entry] of queue.entries.entries()) {
    const prefix = `entries[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`${prefix} must be an object`);
    }
    if (!/^articles\/[a-z0-9-]+\.md$/.test(entry.article || "")) {
      fail(`${prefix}.article is invalid: ${entry.article}`);
    }
    if (seen.has(entry.article)) fail(`duplicate queue article: ${entry.article}`);
    seen.add(entry.article);
    parseDate(entry.enqueuedAt, `${prefix}.enqueuedAt`);
    if (!Number.isInteger(entry.attempts) || entry.attempts < 0) {
      fail(`${prefix}.attempts must be a non-negative integer`);
    }
    if (entry.lastAttemptAt !== null) {
      parseDate(entry.lastAttemptAt, `${prefix}.lastAttemptAt`);
    }
    const articlePath = path.resolve(root, entry.article);
    if (!articlePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(articlePath)) {
      fail(`${prefix}.article does not exist: ${entry.article}`);
    }
    readPublished(entry.article);
  }

  for (const [index, entry] of (queue.blocked || []).entries()) {
    const prefix = `blocked[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`${prefix} must be an object`);
    }
    if (!/^articles\/[a-z0-9-]+\.md$/.test(entry.article || "")) {
      fail(`${prefix}.article is invalid: ${entry.article}`);
    }
    if (seen.has(entry.article)) fail(`article is both queued and blocked: ${entry.article}`);
    seen.add(entry.article);
    parseDate(entry.blockedAt, `${prefix}.blockedAt`);
  }
  return queue;
};

function readPublished(article) {
  const articlePath = path.resolve(root, article);
  const text = fs.readFileSync(articlePath, "utf8");
  const matches = [...text.matchAll(/^published:\s*(true|false)\s*$/gm)];
  if (matches.length !== 1) fail(`${article} must contain exactly one published field`);
  return matches[0][1] === "true";
}

const writePublished = (article, published) => {
  const articlePath = path.resolve(root, article);
  const text = fs.readFileSync(articlePath, "utf8");
  const matches = [...text.matchAll(/^published:\s*(true|false)\s*$/gm)];
  if (matches.length !== 1) fail(`${article} must contain exactly one published field`);
  const next = text.replace(/^published:\s*(true|false)\s*$/m, `published: ${published}`);
  fs.writeFileSync(articlePath, next);
};

const writeQueue = (queue) => {
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
};

const slugOf = (article) => path.basename(article, ".md");

const readApi = () => {
  if (!options["api-json"]) fail("decide requires --api-json");
  let response;
  try {
    response = JSON.parse(fs.readFileSync(path.resolve(options["api-json"]), "utf8"));
  } catch (error) {
    fail(`cannot read Zenn API response: ${error.message}`);
  }
  if (!Array.isArray(response.articles)) fail("Zenn API response must contain articles[]");
  return response.articles;
};

const decision = (queue, articles, now) => {
  const cutoff = now.getTime() - (24 * 60 * 60 * 1000);
  const recent = articles.filter((article) => {
    if (typeof article?.published_at !== "string") return false;
    const publishedAt = new Date(article.published_at).getTime();
    return Number.isFinite(publishedAt) && publishedAt > cutoff && publishedAt <= now.getTime();
  });
  const common = {
    recentPublications: recent.length,
    maxPublicationsPer24Hours: queue.maxPublicationsPer24Hours,
    pending: queue.entries.length,
  };
  if (queue.entries.length === 0) {
    return { action: "empty", reason: "publication queue is empty", ...common };
  }

  const entry = queue.entries[0];
  const slug = slugOf(entry.article);
  const maxAttempts = queue.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const details = {
    article: entry.article, slug, attempts: entry.attempts, maxAttempts, ...common,
  };
  if (articles.some((article) => article?.slug === slug)) {
    return { action: "reconcile", reason: "article is visible in the public Zenn API", ...details };
  }

  const published = readPublished(entry.article);
  // Give up before any wait: a head that Zenn refuses to serve must not hold the
  // rest of the queue hostage for another backoff window.
  if (published && entry.attempts >= maxAttempts) {
    return {
      action: "block",
      reason: "article never became public within the attempt limit",
      ...details,
    };
  }

  if (recent.length >= queue.maxPublicationsPer24Hours) {
    return { action: "wait_rate_limit", reason: "conservative 24-hour publication limit is full", ...details };
  }

  if (!published) {
    return { action: "publish", reason: "capacity is available for the queue head", ...details };
  }

  if (entry.lastAttemptAt !== null) {
    const retryAt = new Date(entry.lastAttemptAt).getTime()
      + (queue.retryAfterHours * 60 * 60 * 1000);
    if (retryAt > now.getTime()) {
      return {
        action: "wait_retry_backoff",
        reason: "previous deployment attempt is still in retry backoff",
        retryAt: new Date(retryAt).toISOString(),
        ...details,
      };
    }
  }
  return { action: "retry", reason: "article is not public and retry backoff has elapsed", ...details };
};

switch (command) {
  case "validate": {
    const queue = readQueue();
    console.log(`valid queue: ${queue.entries.length} pending article(s)`);
    break;
  }
  case "pending-count": {
    const queue = readQueue();
    console.log(queue.entries.length);
    break;
  }
  case "decide": {
    const queue = readQueue();
    const articles = readApi();
    const now = parseDate(options.now || new Date().toISOString(), "--now");
    console.log(JSON.stringify(decision(queue, articles, now)));
    break;
  }
  case "enqueue": {
    const article = options.article;
    if (!/^articles\/[a-z0-9-]+\.md$/.test(article || "")) fail("enqueue requires a valid --article");
    const articlePath = path.resolve(root, article);
    if (!articlePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(articlePath)) {
      fail(`article does not exist: ${article}`);
    }
    if (readPublished(article)) fail(`queued article must have published: false: ${article}`);
    const queue = readQueue();
    if ((queue.blocked || []).some((entry) => entry.article === article)) {
      fail(`article is blocked; remove it from blocked before re-queueing: ${article}`);
    }
    if (!queue.entries.some((entry) => entry.article === article)) {
      const now = parseDate(options.now || new Date().toISOString(), "--now");
      queue.entries.push({
        article,
        enqueuedAt: now.toISOString(),
        attempts: 0,
        lastAttemptAt: null,
      });
      writeQueue(queue);
    }
    console.log(JSON.stringify({ action: "enqueued", article, pending: queue.entries.length }));
    break;
  }
  case "apply": {
    const action = options.action;
    const slug = options.slug;
    const allowed = new Set(["publish", "retry", "reconcile", "block"]);
    if (!allowed.has(action)) {
      fail("apply requires --action publish, retry, reconcile, or block");
    }
    const queue = readQueue();
    if (queue.entries.length === 0) fail("cannot apply an action to an empty queue");
    const entry = queue.entries[0];
    if (slugOf(entry.article) !== slug) fail(`queue head changed; expected slug ${slug}`);
    const now = parseDate(options.now || new Date().toISOString(), "--now");
    const published = readPublished(entry.article);
    if (action === "publish") {
      if (published) fail(`publish action requires published: false: ${entry.article}`);
      writePublished(entry.article, true);
      entry.attempts += 1;
      entry.lastAttemptAt = now.toISOString();
    } else if (action === "retry") {
      if (!published) fail(`retry action requires published: true: ${entry.article}`);
      entry.attempts += 1;
      entry.lastAttemptAt = now.toISOString();
    } else if (action === "block") {
      if (!published) fail(`block action requires published: true: ${entry.article}`);
      queue.blocked = queue.blocked || [];
      queue.blocked.push({
        article: entry.article,
        enqueuedAt: entry.enqueuedAt,
        attempts: entry.attempts,
        lastAttemptAt: entry.lastAttemptAt,
        blockedAt: now.toISOString(),
        reason: "article never became public within the attempt limit",
      });
      queue.entries.shift();
    } else {
      if (!published) writePublished(entry.article, true);
      queue.entries.shift();
    }
    writeQueue(queue);
    console.log(JSON.stringify({ action, article: entry.article, pending: queue.entries.length }));
    break;
  }
  default:
    fail("usage: zenn-publish-queue.mjs <validate|pending-count|decide|enqueue|apply> [options]");
}
