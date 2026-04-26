import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("package manifest supports standard global installation", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.notEqual(pkg.private, true);
  assert.equal(pkg.bin["codex-npm-check"], "bin/cnc.js");
  assert.equal(pkg.bin.cnc, "bin/cnc.js");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.repository.url, "git+https://github.com/FelixWardUS/codex-npm-check.git");
  assert.equal(pkg.bugs.url, "https://github.com/FelixWardUS/codex-npm-check/issues");
  assert.equal(pkg.publishConfig.registry, "https://registry.npmjs.org/");
  assert.ok(pkg.keywords.includes("codex-cli"));
  assert.ok(pkg.files.includes("LICENSE"));
});

test("GitHub Action wrapper runs the local CLI", async () => {
  const action = await readFile(new URL("../action.yml", import.meta.url), "utf8");

  assert.match(action, /name: Check Codex npm release/);
  assert.match(action, /platforms:/);
  assert.match(action, /node "\$GITHUB_ACTION_PATH\/bin\/cnc\.js"/);
});
