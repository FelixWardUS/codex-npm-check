import test from "node:test";
import assert from "node:assert/strict";
import { parseStableVersions } from "../src/npm.js";

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
