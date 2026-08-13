import os from "node:os";

const sensitiveKey = /(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|credential|secret|session[_-]?id|signature)/i;
const localUser = os.userInfo().username;

export function redactText(value) {
  if (typeof value !== "string") return value;
  return value
    .split(os.homedir()).join("$HOME")
    .split(localUser).join("$USER")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]")
    .replace(/\b(?:Bearer\s+)?eyJ[A-Za-z0-9._-]{20,}\b/g, "[REDACTED_TOKEN]");
}

export function redactValue(value, key = "") {
  if (sensitiveKey.test(key)) return value == null ? value : "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redactValue(child, childKey)]));
  }
  return typeof value === "string" ? redactText(value) : value;
}

export function redactJsonLines(text) {
  return String(text || "").split(/\r?\n/).map((line) => {
    if (!line.trim()) return "";
    try {
      return JSON.stringify(redactValue(JSON.parse(line)));
    } catch {
      return redactText(line);
    }
  }).join("\n");
}
