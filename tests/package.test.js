import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("package manifest supports standard global installation", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.notEqual(pkg.private, true);
  assert.equal(pkg.bin.ccr, "./bin/ccr.js");
});
