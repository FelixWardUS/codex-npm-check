import test from "node:test";
import assert from "node:assert/strict";
import { summarizeVersionStatus } from "../src/checker.js";

test("summarizeVersionStatus marks missing platform packages", () => {
  const result = summarizeVersionStatus("0.124.0", {
    "linux-x64": false,
    "darwin-arm64": true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.lines[0], "0.124.0");
  assert.match(result.lines[1], /linux-x64: missing/);
  assert.match(result.lines[2], /darwin-arm64: OK/);
});

test("summarizeVersionStatus reports a missing main package", () => {
  const result = summarizeVersionStatus(
    "0.200.0",
    {
      "linux-x64": false,
    },
    { mainExists: false },
  );

  assert.equal(result.ok, false);
  assert.match(result.lines[1], /main package: missing/);
});
