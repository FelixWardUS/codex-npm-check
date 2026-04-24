import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

async function makeStubNpm() {
  const dir = await mkdtemp(path.join(tmpdir(), "ccr-cli-"));
  const stubPath = path.join(dir, "npm");

  await writeFile(
    stubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2).join(" ");
if (args === "view @openai/codex versions --json") {
  process.stdout.write(JSON.stringify([
    "0.122.0",
    "0.123.0",
    "0.124.0-alpha.3",
    "0.124.0",
    "0.124.0-linux-x64"
  ]));
  process.exit(0);
}
const mainMatch = args.match(/^view @openai\\/codex@(\\d+\\.\\d+\\.\\d+) version$/);
if (mainMatch) {
  process.stdout.write(mainMatch[1]);
  process.exit(0);
}
const platformMatch = args.match(/^view @openai\\/codex@(\\d+\\.\\d+\\.\\d+)-(linux-x64|darwin-arm64) version$/);
if (platformMatch) {
  if (platformMatch[1] === "0.124.0" && platformMatch[2] === "linux-x64") {
    process.exit(1);
  }
  process.stdout.write(platformMatch[0]);
  process.exit(0);
}
process.exit(1);
`,
    { mode: 0o755 },
  );

  return { dir, stubPath };
}

test("ccr first run saves config and checks releases", async () => {
  const { dir, stubPath } = await makeStubNpm();
  const configHome = path.join(dir, "config");

  const result = spawnSync("node", ["bin/ccr.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: "1,4\n3\n",
    env: {
      ...process.env,
      NPM_BIN: stubPath,
      CCR_CONFIG_HOME: configHome,
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Configure ccr/);
  assert.match(result.stdout, /Saved config/);
  assert.match(result.stdout, /0.124.0/);
  assert.match(result.stdout, /linux-x64: missing/);

  const saved = JSON.parse(await readFile(path.join(configHome, "ccr", "config.json"), "utf8"));
  assert.deepEqual(saved, {
    platforms: ["linux-x64", "darwin-arm64"],
    latestCount: 3,
  });
});

test("ccr --show prints the saved configuration", async () => {
  const { dir, stubPath } = await makeStubNpm();
  const configHome = path.join(dir, "config");
  await writeFile(
    path.join(configHome, "ccr", "config.json"),
    JSON.stringify({
      platforms: ["linux-x64", "darwin-arm64"],
      latestCount: 2,
    }),
    { encoding: "utf8", flag: "w" },
  ).catch(async () => {
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(path.join(configHome, "ccr"), { recursive: true }),
    );
    await writeFile(
      path.join(configHome, "ccr", "config.json"),
      JSON.stringify({
        platforms: ["linux-x64", "darwin-arm64"],
        latestCount: 2,
      }),
      "utf8",
    );
  });

  const result = spawnSync("node", ["bin/ccr.js", "--show"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NPM_BIN: stubPath,
      CCR_CONFIG_HOME: configHome,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Platforms:/);
  assert.match(result.stdout, /linux-x64/);
  assert.match(result.stdout, /Latest stable versions: 2/);
});

test("ccr --reset removes the saved configuration", async () => {
  const { dir, stubPath } = await makeStubNpm();
  const configHome = path.join(dir, "config");
  const configPath = path.join(configHome, "ccr", "config.json");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(configHome, "ccr"), { recursive: true }));
  await writeFile(
    configPath,
    JSON.stringify({
      platforms: ["linux-x64"],
      latestCount: 1,
    }),
    "utf8",
  );

  const result = spawnSync("node", ["bin/ccr.js", "--reset"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NPM_BIN: stubPath,
      CCR_CONFIG_HOME: configHome,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Configuration reset/);
  await assert.rejects(access(configPath));
});
