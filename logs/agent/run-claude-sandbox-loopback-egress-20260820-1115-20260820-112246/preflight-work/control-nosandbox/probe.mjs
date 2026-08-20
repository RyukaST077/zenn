#!/usr/bin/env node

// One loopback-pinned HTTP GET, recorded deterministically.
// The probe never resolves a name and never accepts a non-loopback target,
// so a sandboxed run of this file cannot reach any external host.

import fs from "node:fs";
import http from "node:http";

const LOOPBACK_HOST = "127.0.0.1";
const BODY_MARKER = "LOOPBACK_MARKER_OK";
const PROXY_NAMES = [
  "HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy",
  "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy",
];
const fail = (message) => {
  process.stderr.write(`probe error: ${message}\n`);
  process.exit(2);
};

let target;
try {
  target = JSON.parse(fs.readFileSync("target.json", "utf8"));
} catch (error) {
  fail(`cannot read target.json: ${error.message}`);
}
if (target?.host !== LOOPBACK_HOST) fail("target host is not the pinned loopback literal");
if (!Number.isInteger(target.port) || target.port < 1024 || target.port > 65535) fail("target port is invalid");
if (typeof target.path !== "string" || !target.path.startsWith("/")) fail("target path is invalid");

const observation = await new Promise((resolve) => {
  const request = http.request({
    host: LOOPBACK_HOST,
    port: target.port,
    path: target.path,
    method: "GET",
    agent: false,
    setHost: true,
    headers: { "user-agent": "agent-practice-loopback-probe/1" },
    timeout: 4000,
  }, (response) => {
    const chunks = [];
    response.on("data", (chunk) => chunks.push(chunk));
    response.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      resolve({
        connected: true,
        status: response.statusCode ?? null,
        bytes: Buffer.byteLength(body),
        body_marker_present: body.includes(BODY_MARKER),
        error_code: null,
        error_syscall: null,
        error_message: null,
        timed_out: false,
      });
    });
  });
  request.on("timeout", () => {
    request.destroy(Object.assign(new Error("loopback probe timed out"), { code: "ETIMEDOUT", syscall: "connect" }));
  });
  request.on("error", (error) => resolve({
    connected: false,
    status: null,
    bytes: 0,
    body_marker_present: false,
    error_code: error.code ?? null,
    error_syscall: error.syscall ?? null,
    error_message: String(error.message),
    timed_out: error.code === "ETIMEDOUT",
  }));
  request.end();
});

const result = {
  schema_version: 1,
  target: { host: LOOPBACK_HOST, port: target.port, path: target.path, scope: "loopback-only" },
  external_hosts_contacted: 0,
  name_resolution_used: false,
  proxy_environment_names_present: PROXY_NAMES.filter((name) => typeof process.env[name] === "string").sort(),
  ...observation,
};
fs.writeFileSync("probe.json", `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${observation.connected ? "PROBE_CONNECTED" : "PROBE_BLOCKED"} ${observation.connected ? observation.status : observation.error_code}\n`);
