import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function compareSemver(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }

  return 0;
}

export function parseStableVersions(versions) {
  return [...new Set(versions.filter((value) => /^\d+\.\d+\.\d+$/.test(value)))].sort(compareSemver);
}

export async function getAllStableVersions({ npmBin = process.env.NPM_BIN || "npm" } = {}) {
  const { stdout } = await execFileAsync(npmBin, ["view", "@openai/codex", "versions", "--json"], {
    encoding: "utf8",
  });

  const parsed = JSON.parse(stdout);
  const versions = Array.isArray(parsed) ? parsed : [parsed];
  return parseStableVersions(versions);
}

export async function getLatestStableVersions({
  npmBin = process.env.NPM_BIN || "npm",
  count,
} = {}) {
  const versions = await getAllStableVersions({ npmBin });
  return versions.slice(-count);
}
