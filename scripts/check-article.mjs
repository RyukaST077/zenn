#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const article = argv[0];
const expectAt = argv.indexOf("--expect-published");
const expected = expectAt >= 0 ? argv[expectAt + 1] : null;
const root = process.cwd();
const errors = [];

if (!article || !fs.existsSync(article)) {
  console.error(`BLOCKER: article does not exist: ${article || "(missing)"}`);
  process.exit(1);
}

const rel = path.relative(root, path.resolve(article)).split(path.sep).join("/");
if (!/^articles\/[a-z0-9-]+\.md$/.test(rel)) errors.push("article path must be articles/<valid-slug>.md");
const slug = path.basename(article, ".md");
if (slug.length < 12 || slug.length > 50) errors.push("slug length must be 12-50 characters");

const text = fs.readFileSync(article, "utf8");
const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
if (!fm) errors.push("YAML front matter is missing or malformed");
const front = fm?.[1] || "";
const scalar = (name) => front.match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m"))?.[1];
const title = scalar("title")?.replace(/^['"]|['"]$/g, "");
const published = scalar("published");
if (!title || title.length > 70) errors.push("title must be non-empty and at most 70 characters");
if (scalar("type") !== "tech") errors.push("type must be tech");
if (!/^emoji:\s*.+$/m.test(front)) errors.push("emoji is required");
const inlineTopics = front.match(/^topics:\s*\[([^\]]*)\]\s*$/m)?.[1]
  .split(",").map((item) => item.trim()).filter(Boolean);
const blockTopics = front.match(/^topics:\s*\n((?:\s+-\s+.+\n?)+)/m)?.[1]
  .split("\n").map((item) => item.replace(/^\s+-\s+/, "").trim()).filter(Boolean);
const topics = inlineTopics || blockTopics || [];
if (topics.length < 1 || topics.length > 5) errors.push("topics must contain 1-5 entries");
if (!new Set(["true", "false"]).has(published)) errors.push("published must be true or false");
if (expected && published !== expected) errors.push(`published must be ${expected}`);

const fenceCount = (text.match(/^```/gm) || []).length;
if (fenceCount % 2 !== 0) errors.push("code fence is not closed");
if (text.includes("<!-- 要素材 -->")) errors.push("unresolved material placeholder exists");

const imageRefs = [...text.matchAll(/!\[[^\]]*\]\((\/images\/([a-z0-9-]+)\/[^)\s]+)\)/g)];
for (const match of imageRefs) {
  if (match[2] !== slug) errors.push(`image reference uses a different slug: ${match[1]}`);
  const target = path.join(root, match[1].slice(1));
  if (!fs.existsSync(target)) errors.push(`referenced image is missing: ${match[1]}`);
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /(?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*['"]?[A-Za-z0-9_\-/.+]{12,}/i
];
if (secretPatterns.some((pattern) => pattern.test(text))) errors.push("possible secret detected");

const duplicate = fs.readdirSync(path.join(root, "articles"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name === `${slug}.md`).length;
if (duplicate !== 1) errors.push("slug is not locally unique");

if (errors.length) {
  for (const error of [...new Set(errors)]) console.error(`BLOCKER: ${error}`);
  process.exit(1);
}
console.log(`OK: ${rel} (slug=${slug}, published=${published})`);
