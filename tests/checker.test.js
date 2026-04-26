import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkVersionRelease, summarizeVersionStatus } from "../src/checker.js";

const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";

async function makeStubNpm(responses) {
  const dir = await mkdtemp(path.join(tmpdir(), "cnc-checker-"));
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

async function withTarballServer(routes, callback) {
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const routeKey = `${request.method} ${url.pathname}`;
    const route = routes[routeKey] ?? routes[url.pathname] ?? 404;
    requests.push(routeKey);

    if (route === "destroy") {
      request.socket.destroy();
      return;
    }

    if (typeof route === "function") {
      route(request, response);
      return;
    }

    const status = route;
    response.writeHead(status, { "content-type": "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : "tarball");
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function packageStatus(overrides) {
  return {
    metadataExists: true,
    tarballUrl: "data:application/gzip,ok",
    tarballAvailable: true,
    ok: true,
    reason: null,
    ...overrides,
  };
}

function cacheAddKey(tarballUrl) {
  return `cache add ${tarballUrl} --prefer-online`;
}

function officialViewKey(packageSpec, field) {
  return `view ${packageSpec} ${field} --registry ${OFFICIAL_REGISTRY} --@openai:registry=${OFFICIAL_REGISTRY}`;
}

test("summarizeVersionStatus marks missing platform packages", () => {
  const result = summarizeVersionStatus(
    "0.124.0",
    {
      "linux-x64": packageStatus({
        metadataExists: false,
        tarballUrl: null,
        tarballAvailable: false,
        ok: false,
        reason: "metadata missing",
      }),
      "darwin-arm64": packageStatus({}),
    },
    { mainPackageStatus: packageStatus({}) },
  );

  assert.equal(result.ok, false);
  assert.equal(result.lines[0], "0.124.0: issues found ❌");
  assert.match(result.lines.join("\n"), /linux-x64: metadata missing ❌/);
  assert.match(result.lines.join("\n"), /darwin-arm64: OK ✅/);
});

test("summarizeVersionStatus reports a missing main package", () => {
  const result = summarizeVersionStatus(
    "0.200.0",
    {
      "linux-x64": packageStatus({}),
    },
    {
      mainPackageStatus: packageStatus({
        metadataExists: false,
        tarballUrl: null,
        tarballAvailable: false,
        ok: false,
        reason: "metadata missing",
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.lines.join("\n"), /main package: metadata missing ❌/);
});

test("checkVersionRelease reports metadata missing with a failure marker", async () => {
  const npmBin = await makeStubNpm({
    "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
    "view @openai/codex@0.124.0 dist.tarball": { stdout: "data:application/gzip,ok" },
    "view @openai/codex@0.124.0-linux-x64 version": {
      status: 1,
      stderr: "npm error code E404\n404 Not Found\n",
    },
  });

  const result = await checkVersionRelease({
    version: "0.124.0",
    platforms: ["linux-x64"],
    npmBin,
  });

  const status = result.platformStatuses["linux-x64"];
  assert.equal(status.metadataExists, false);
  assert.equal(status.tarballAvailable, false);
  assert.equal(status.ok, false);
  assert.equal(status.reason, "metadata missing");
  assert.match(result.lines.join("\n"), /linux-x64: metadata missing ❌/);
});

test("checkVersionRelease reports tarball 404 as unavailable with a failure marker", async () => {
  await withTarballServer(
    {
      "/main.tgz": 200,
      "/linux-x64.tgz": 404,
    },
    async (baseUrl) => {
      const platformTarballUrl = `${baseUrl}/linux-x64.tgz`;
      const npmBin = await makeStubNpm({
        "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
        "view @openai/codex@0.124.0 dist.tarball": { stdout: `${baseUrl}/main.tgz` },
        "view @openai/codex@0.124.0-linux-x64 version": { stdout: "0.124.0-linux-x64" },
        "view @openai/codex@0.124.0-linux-x64 dist.tarball": {
          stdout: platformTarballUrl,
        },
      });

      const result = await checkVersionRelease({
        version: "0.124.0",
        platforms: ["linux-x64"],
        npmBin,
      });

      const status = result.platformStatuses["linux-x64"];
      assert.equal(status.metadataExists, true);
      assert.equal(status.tarballUrl, platformTarballUrl);
      assert.equal(status.tarballAvailable, false);
      assert.equal(status.ok, false);
      assert.equal(status.reason, "tarball unavailable");
      assert.match(result.lines.join("\n"), /linux-x64: tarball unavailable ❌/);
    },
  );
});

test("checkVersionRelease reports OK when metadata and tarball are available", async () => {
  await withTarballServer(
    {
      "/main.tgz": 200,
      "/linux-x64.tgz": 200,
    },
    async (baseUrl) => {
      const platformTarballUrl = `${baseUrl}/linux-x64.tgz`;
      const npmBin = await makeStubNpm({
        "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
        "view @openai/codex@0.124.0 dist.tarball": { stdout: `${baseUrl}/main.tgz` },
        "view @openai/codex@0.124.0-linux-x64 version": { stdout: "0.124.0-linux-x64" },
        "view @openai/codex@0.124.0-linux-x64 dist.tarball": {
          stdout: platformTarballUrl,
        },
      });

      const result = await checkVersionRelease({
        version: "0.124.0",
        platforms: ["linux-x64"],
        npmBin,
      });

      assert.equal(result.ok, true);
      assert.match(result.lines[0], /0\.124\.0: OK ✅/);
      assert.match(result.lines.join("\n"), /main package: OK ✅/);
      assert.match(result.lines.join("\n"), /linux-x64: OK ✅/);
      assert.deepEqual(result.platformStatuses["linux-x64"], {
        metadataExists: true,
        tarballUrl: platformTarballUrl,
        tarballAvailable: true,
        ok: true,
        reason: null,
        registries: {
          official: {
            metadataExists: true,
            tarballUrl: platformTarballUrl,
            tarballAvailable: true,
            ok: true,
            reason: null,
          },
        },
      });
    },
  );
});

test("checkVersionRelease checks configured and official registries when configured registry is a mirror", async () => {
  await withTarballServer(
    {
      "/official-linux-x64.tgz": 404,
    },
    async (baseUrl) => {
      const npmBin = await makeStubNpm({
        "config get @openai:registry": { stdout: "https://registry.npmmirror.com/\n" },
        "config get registry": { stdout: `${OFFICIAL_REGISTRY}\n` },
        "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
        "view @openai/codex@0.124.0 dist.tarball": {
          stdout: "data:application/gzip,configured-main",
        },
        "view @openai/codex@0.124.0-linux-x64 version": {
          stdout: "0.124.0-linux-x64",
        },
        "view @openai/codex@0.124.0-linux-x64 dist.tarball": {
          stdout: "data:application/gzip,configured-linux-x64",
        },
        [officialViewKey("@openai/codex@0.124.0", "version")]: {
          stdout: "0.124.0",
        },
        [officialViewKey("@openai/codex@0.124.0", "dist.tarball")]: {
          stdout: "data:application/gzip,official-main",
        },
        [officialViewKey("@openai/codex@0.124.0-linux-x64", "version")]: {
          stdout: "0.124.0-linux-x64",
        },
        [officialViewKey("@openai/codex@0.124.0-linux-x64", "dist.tarball")]: {
          stdout: `${baseUrl}/official-linux-x64.tgz`,
        },
      });

      const result = await checkVersionRelease({
        version: "0.124.0",
        platforms: ["linux-x64"],
        npmBin,
      });

      const status = result.platformStatuses["linux-x64"];
      assert.equal(result.ok, false);
      assert.equal(status.ok, false);
      assert.equal(status.tarballUrl, null);
      assert.equal(status.reason, "registry issues found");
      assert.equal(status.registries.configured.ok, true);
      assert.equal(status.registries.official.ok, false);
      assert.equal(status.registries.official.reason, "tarball unavailable");
      assert.match(
        result.lines.join("\n"),
        /linux-x64: issues found ❌\n    configured: OK ✅\n    official: tarball unavailable ❌/,
      );
      assert.match(result.lines.join("\n"), /main package: OK ✅/);
    },
  );
});

test("checkVersionRelease does not duplicate registry checks when configured registry is official", async () => {
  const npmBin = await makeStubNpm({
    "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
    "view @openai/codex@0.124.0 dist.tarball": {
      stdout: "data:application/gzip,official-main",
    },
    "view @openai/codex@0.124.0-linux-x64 version": {
      stdout: "0.124.0-linux-x64",
    },
    "view @openai/codex@0.124.0-linux-x64 dist.tarball": {
      stdout: "data:application/gzip,official-linux-x64",
    },
  });

  const result = await checkVersionRelease({
    version: "0.124.0",
    platforms: ["linux-x64"],
    npmBin,
  });

  assert.deepEqual(Object.keys(result.mainPackageStatus.registries), ["official"]);
  assert.deepEqual(Object.keys(result.platformStatuses["linux-x64"].registries), ["official"]);
  assert.equal(result.ok, true);
  assert.match(result.lines.join("\n"), /linux-x64: OK ✅/);
  assert.doesNotMatch(result.lines.join("\n"), /configured:/);
});

test("checkVersionRelease falls back to npm network access when a lightweight probe is denied", async () => {
  await withTarballServer(
    {
      "/main.tgz": 200,
      "/linux-x64.tgz": 403,
    },
    async (baseUrl, requests) => {
      const platformTarballUrl = `${baseUrl}/linux-x64.tgz`;
      const npmBin = await makeStubNpm({
        "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
        "view @openai/codex@0.124.0 dist.tarball": { stdout: `${baseUrl}/main.tgz` },
        "view @openai/codex@0.124.0-linux-x64 version": { stdout: "0.124.0-linux-x64" },
        "view @openai/codex@0.124.0-linux-x64 dist.tarball": {
          stdout: platformTarballUrl,
        },
        [cacheAddKey(platformTarballUrl)]: {},
      });

      const result = await checkVersionRelease({
        version: "0.124.0",
        platforms: ["linux-x64"],
        npmBin,
      });

      assert.equal(result.platformStatuses["linux-x64"].ok, true);
      assert.deepEqual(requests.filter((request) => request.endsWith("/linux-x64.tgz")), [
        "HEAD /linux-x64.tgz",
        "GET /linux-x64.tgz",
      ]);
      assert.match(result.lines.join("\n"), /linux-x64: OK ✅/);
    },
  );
});

test("checkVersionRelease uses range GET fallback after a non-OK HEAD response", async () => {
  await withTarballServer(
    {
      "/main.tgz": 200,
      "HEAD /linux-x64.tgz": 403,
      "GET /linux-x64.tgz": (request, response) => {
        assert.equal(request.headers.range, "bytes=0-0");
        response.writeHead(206, { "content-type": "application/octet-stream" });
        response.end("x");
      },
    },
    async (baseUrl, requests) => {
      const npmBin = await makeStubNpm({
        "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
        "view @openai/codex@0.124.0 dist.tarball": { stdout: `${baseUrl}/main.tgz` },
        "view @openai/codex@0.124.0-linux-x64 version": { stdout: "0.124.0-linux-x64" },
        "view @openai/codex@0.124.0-linux-x64 dist.tarball": {
          stdout: `${baseUrl}/linux-x64.tgz`,
        },
        [cacheAddKey(`${baseUrl}/linux-x64.tgz`)]: {
          status: 1,
          stderr: "npm error code EAI_AGAIN\nnpm error network timeout\n",
        },
      });

      const result = await checkVersionRelease({
        version: "0.124.0",
        platforms: ["linux-x64"],
        npmBin,
      });

      assert.equal(result.platformStatuses["linux-x64"].ok, true);
      assert.ok(requests.includes("GET /linux-x64.tgz"));
      assert.match(result.lines.join("\n"), /linux-x64: OK ✅/);
    },
  );
});

test("checkVersionRelease reports tarball fetch failures separately", async () => {
  await withTarballServer(
    {
      "/main.tgz": 200,
      "HEAD /linux-x64.tgz": "destroy",
      "GET /linux-x64.tgz": "destroy",
    },
    async (baseUrl) => {
      const npmBin = await makeStubNpm({
        "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
        "view @openai/codex@0.124.0 dist.tarball": { stdout: `${baseUrl}/main.tgz` },
        "view @openai/codex@0.124.0-linux-x64 version": { stdout: "0.124.0-linux-x64" },
        "view @openai/codex@0.124.0-linux-x64 dist.tarball": {
          stdout: `${baseUrl}/linux-x64.tgz`,
        },
        [cacheAddKey(`${baseUrl}/linux-x64.tgz`)]: {
          status: 1,
          stderr: "npm error code EAI_AGAIN\nnpm error network timeout\n",
        },
      });

      const result = await checkVersionRelease({
        version: "0.124.0",
        platforms: ["linux-x64"],
        npmBin,
      });

      const status = result.platformStatuses["linux-x64"];
      assert.equal(status.metadataExists, true);
      assert.equal(status.tarballAvailable, false);
      assert.equal(status.ok, false);
      assert.equal(status.reason, "tarball fetch failed");
      assert.match(status.tarballError, /EAI_AGAIN/);
      assert.match(result.lines.join("\n"), /linux-x64: tarball fetch failed ❌/);
    },
  );
});

test("checkVersionRelease throws npm query failures that are not 404", async () => {
  const npmBin = await makeStubNpm({
    "view @openai/codex@0.124.0 version": { stdout: "0.124.0" },
    "view @openai/codex@0.124.0 dist.tarball": { stdout: "data:application/gzip,ok" },
    "view @openai/codex@0.124.0-linux-x64 version": {
      status: 1,
      stderr: "npm error code EAI_AGAIN\nnetwork timeout\n",
    },
  });

  await assert.rejects(
    checkVersionRelease({
      version: "0.124.0",
      platforms: ["linux-x64"],
      npmBin,
    }),
    /npm view failed for @openai\/codex@0\.124\.0-linux-x64(?: using https:\/\/registry\.npmjs\.org\/)?:.*EAI_AGAIN/s,
  );
});
