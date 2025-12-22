import fs from "node:fs";

export function parseDotenv(content) {
  const out = {};
  const lines = String(content ?? "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function loadDotenvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return parseDotenv(content);
  } catch {
    return {};
  }
}

export function upsertDotenvKey(content, key, value) {
  const lines = String(content ?? "").split(/\r?\n/);
  let found = false;
  const out = lines.map((line) => {
    const idx = line.indexOf("=");
    if (idx <= 0) return line;
    const k = line.slice(0, idx).trim();
    if (k !== key) return line;
    found = true;
    return `${key}=${value}`;
  });
  if (!found) out.push(`${key}=${value}`);
  // ensure trailing newline
  return out.join("\n").replace(/\n*$/, "\n");
}

export function parseDeployedAddress(output) {
  const s = String(output ?? "");
  // Common forge outputs:
  // - "Deployed at: 0x..."
  // - "Deployed to: 0x..."
  const m = s.match(/Deployed (?:at|to):\s*(0x[a-fA-F0-9]{40})/);
  return m ? m[1] : null;
}

export function normalizeBoolFlag(v, defaultValue = false) {
  if (v === undefined || v === null) return defaultValue;
  const s = String(v).trim().toLowerCase();
  if (s === "") return true;
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return defaultValue;
}

