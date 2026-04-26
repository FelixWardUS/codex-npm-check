import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLatestStableVersions, parseStableVersions } from "../src/npm.js";

const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";

async function makeStubNpm(responses) {
  const dir = await mkdtemp(path.join(tmpdir(), "ccr-npm-"));
  const stubPath = path.join(dir, "npm");
  const mergedResponses = {
    "config get @openai:registry": { stdout: "undefined\n" },
    "config get registry": { stdout: `${OFFICIAL_REGISTRY}\n` },
    ...responses,
  };

  await writeFile(
    stubPath,
    `#!/usr/bin/env node
const responses = ${JSON.stringify(mergedResponses)};
const key = process.argv.slice(2).join(" ");
const response = responses[key];

if (!response) {
  process.stderr.write("unexpected npm command: " + key + "\\n");
  process.exit(1);
}

if (response.status && response.status !== 0) {
  process.stderr.write(response.stderr || "");
  process.exit(response.status);
}

process.stdout.write(response.stdout || "");
`,
    { mode: 0o755 },
  );

  return stubPath;
}

function officialViewKey(packageSpec, field) {
  return `view ${packageSpec} ${field} --registry ${OFFICIAL_REGISTRY} --@openai:registry=${OFFICIAL_REGISTRY}`;
}

test("parseStableVersions keeps only stable semver entries and sorts them", () => {
  const versions = parseStableVersions([
    "0.124.0-alpha.3",
    "0.123.0",
    "0.123.0-linux-x64",
    "0.124.0",
    "0.122.0",
    "0.124.0",
  ]);

  assert.deepEqual(versions, ["0.122.0", "0.123.0", "0.124.0"]);
});

test("getLatestStableVersions merges configured and official registry versions", async () => {
  const npmBin = await makeStubNpm({
    "config get @openai:registry": { stdout: "https://registry.npmmirror.com/\n" },
    "config get registry": { stdout: `${OFFICIAL_REGISTRY}\n` },
    "view @openai/codex versions --json": {
      stdout: JSON.stringify(["0.122.0", "0.123.0", "0.124.0"]),
    },
    [officialViewKey("@openai/codex", "versions --json")]: {
      stdout: JSON.stringify(["0.124.0", "0.125.0"]),
    },
  });

  const versions = await getLatestStableVersions({ npmBin, count: 3 });

  assert.deepEqual(versions, ["0.123.0", "0.124.0", "0.125.0"]);
});
