import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.js";
import { PLATFORM_OPTIONS, buildConfigFromAnswers } from "../src/prompts.js";

test("buildConfigFromAnswers parses platform selections and latest count", () => {
  const config = buildConfigFromAnswers({
    platformAnswer: "1,4,6",
    latestAnswer: "4",
  });

  assert.deepEqual(config.platforms, [
    PLATFORM_OPTIONS[0].id,
    PLATFORM_OPTIONS[3].id,
    PLATFORM_OPTIONS[5].id,
  ]);
  assert.equal(config.latestCount, 4);
});

test("buildConfigFromAnswers falls back to defaults on blank answers", () => {
  const config = buildConfigFromAnswers({
    platformAnswer: "",
    latestAnswer: "",
  });

  assert.deepEqual(config, DEFAULT_CONFIG);
});
