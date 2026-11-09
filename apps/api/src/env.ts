import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootEnv = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);

if (existsSync(rootEnv)) {
  for (const rawLine of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim().replace(/^("|')(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}
