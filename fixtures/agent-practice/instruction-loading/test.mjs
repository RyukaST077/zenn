import assert from "node:assert/strict";
import { greet } from "./src/greet.js";

assert.equal(greet("Zenn"), "Hello, Zenn!");
assert.equal(greet("Claude"), "Hello, Claude!");
console.log("PASS: greet returns the required message");
