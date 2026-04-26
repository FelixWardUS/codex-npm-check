import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("cnc --help exits successfully", () => {
  const result = spawnSync("node", ["bin/cnc.js", "--help"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: cnc/);
});
