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
if (args === "config get @openai:registry") {
  process.stdout.write("undefined\\n");
  process.exit(0);
}
if (args === "config get registry") {
  process.stdout.write("https://registry.npmjs.org/\\n");
  process.exit(0);
}
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
const mainTarballMatch = args.match(/^view @openai\\/codex@(\\d+\\.\\d+\\.\\d+) dist\\.tarball$/);
if (mainTarballMatch) {
  process.stdout.write("data:application/gzip,main-" + mainTarballMatch[1]);
  process.exit(0);
}
const platformMatch = args.match(/^view @openai\\/codex@(\\d+\\.\\d+\\.\\d+)-(linux-x64|darwin-arm64) version$/);
if (platformMatch) {
  if (platformMatch[1] === "0.124.0" && platformMatch[2] === "linux-x64") {
    process.stderr.write("npm error code E404\\nNot Found\\n");
    process.exit(1);
  }
  process.stdout.write(platformMatch[0]);
  process.exit(0);
}
const platformTarballMatch = args.match(/^view @openai\\/codex@(\\d+\\.\\d+\\.\\d+)-(linux-x64|darwin-arm64) dist\\.tarball$/);
if (platformTarballMatch) {
  process.stdout.write("data:application/gzip," + platformTarballMatch[1] + "-" + platformTarballMatch[2]);
  process.exit(0);
}
process.exit(1);
`,
    { mode: 0o755 },
  );

  return { dir, stubPath };
}

async function makeRegistryErrorStubNpm() {
  const dir = await mkdtemp(path.join(tmpdir(), "ccr-cli-"));
  const stubPath = path.join(dir, "npm");

  await writeFile(
    stubPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2).join(" ");
if (args === "config get @openai:registry") {
  process.stdout.write("undefined\\n");
  process.exit(0);
}
if (args === "config get registry") {
  process.stdout.write("https://registry.npmjs.org/\\n");
  process.exit(0);
}
if (args === "view @openai/codex versions --json") {
  process.stdout.write(JSON.stringify(["0.124.0"]));
  process.exit(0);
}
if (args === "view @openai/codex@0.124.0 version") {
  process.stdout.write("0.124.0");
  process.exit(0);
}
if (args === "view @openai/codex@0.124.0 dist.tarball") {
  process.stdout.write("data:application/gzip,main-0.124.0");
  process.exit(0);
}
if (args === "view @openai/codex@0.124.0-linux-x64 version") {
  process.stderr.write("npm error code EAI_AGAIN\\nnetwork timeout\\n");
  process.exit(1);
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
  assert.match(result.stdout, /linux-x64: metadata missing ❌/);

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

test("ccr -set is rejected as an invalid option", async () => {
  const result = spawnSync("node", ["bin/ccr.js", "-set"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 64);
  assert.match(result.stdout, /Usage: ccr/);
});

test("ccr supports JSON output with one-run platform and latest overrides", async () => {
  const { dir, stubPath } = await makeStubNpm();

  const result = spawnSync(
    "node",
    ["bin/ccr.js", "--platform", "linux-x64,darwin-arm64", "--latest", "1", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NPM_BIN: stubPath,
        CCR_CONFIG_HOME: path.join(dir, "config"),
      },
    },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /Checking latest/);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.versions.length, 1);
  assert.equal(parsed.versions[0].version, "0.124.0");
  assert.deepEqual(parsed.versions[0].mainPackageStatus, {
    metadataExists: true,
    tarballUrl: "data:application/gzip,main-0.124.0",
    tarballAvailable: true,
    ok: true,
    reason: null,
    registries: {
      official: {
        metadataExists: true,
        tarballUrl: "data:application/gzip,main-0.124.0",
        tarballAvailable: true,
        ok: true,
        reason: null,
      },
    },
  });
  assert.deepEqual(parsed.versions[0].platformStatuses["linux-x64"], {
    metadataExists: false,
    tarballUrl: null,
    tarballAvailable: false,
    ok: false,
    reason: "metadata missing",
    registries: {
      official: {
        metadataExists: false,
        tarballUrl: null,
        tarballAvailable: false,
        ok: false,
        reason: "metadata missing",
      },
    },
  });
  assert.deepEqual(parsed.versions[0].platformStatuses["darwin-arm64"], {
    metadataExists: true,
    tarballUrl: "data:application/gzip,0.124.0-darwin-arm64",
    tarballAvailable: true,
    ok: true,
    reason: null,
    registries: {
      official: {
        metadataExists: true,
        tarballUrl: "data:application/gzip,0.124.0-darwin-arm64",
        tarballAvailable: true,
        ok: true,
        reason: null,
      },
    },
  });
});

test("ccr checks an explicit version with a one-run platform override and no saved config", async () => {
  const { dir, stubPath } = await makeStubNpm();

  const result = spawnSync(
    "node",
    ["bin/ccr.js", "0.123.0", "--platform=linux-x64", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NPM_BIN: stubPath,
        CCR_CONFIG_HOME: path.join(dir, "config"),
      },
    },
  );

  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.versions[0].platformStatuses, {
    "linux-x64": {
      metadataExists: true,
      tarballUrl: "data:application/gzip,0.123.0-linux-x64",
      tarballAvailable: true,
      ok: true,
      reason: null,
      registries: {
        official: {
          metadataExists: true,
          tarballUrl: "data:application/gzip,0.123.0-linux-x64",
          tarballAvailable: true,
          ok: true,
          reason: null,
        },
      },
    },
  });
});

test("ccr rejects invalid one-run platforms", async () => {
  const result = spawnSync("node", ["bin/ccr.js", "--platform", "linux-riscv64"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 64);
  assert.match(result.stdout, /Unsupported platform: linux-riscv64/);
  assert.match(result.stdout, /Usage: ccr/);
});

test("ccr reports npm query failures that are not missing packages", async () => {
  const { dir, stubPath } = await makeRegistryErrorStubNpm();

  const result = spawnSync(
    "node",
    ["bin/ccr.js", "--platform", "linux-x64", "--latest", "1", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NPM_BIN: stubPath,
        CCR_CONFIG_HOME: path.join(dir, "config"),
      },
    },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /npm view failed/);
  assert.match(result.stderr, /@openai\/codex@0\.124\.0-linux-x64/);
  assert.match(result.stderr, /EAI_AGAIN/);
});
