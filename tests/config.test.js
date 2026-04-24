import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, saveConfig } from "../src/config.js";

test("loadConfig returns null when config does not exist", async () => {
  const baseDir = mkdtempSync(path.join(tmpdir(), "ccr-config-"));
  const result = await loadConfig({ baseDir });
  assert.equal(result, null);
});

test("saveConfig persists JSON config under the ccr config directory", async () => {
  const baseDir = mkdtempSync(path.join(tmpdir(), "ccr-config-"));
  const expected = {
    platforms: ["linux-x64", "darwin-arm64"],
    latestCount: 5,
  };

  await saveConfig({ baseDir, config: expected });
  const result = await loadConfig({ baseDir });

  assert.deepEqual(result, expected);
});
