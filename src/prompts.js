import readline from "node:readline";
import { DEFAULT_CONFIG } from "./config.js";

export const PLATFORM_OPTIONS = [
  { id: "linux-x64", label: "Linux x64" },
  { id: "linux-arm64", label: "Linux arm64" },
  { id: "darwin-x64", label: "macOS Intel" },
  { id: "darwin-arm64", label: "macOS Apple Silicon" },
  { id: "win32-x64", label: "Windows x64" },
  { id: "win32-arm64", label: "Windows arm64" },
];

function selectedIndexes(platforms) {
  return platforms
    .map((platform) => PLATFORM_OPTIONS.findIndex((option) => option.id === platform))
    .filter((index) => index >= 0)
    .map((index) => String(index + 1))
    .join(",");
}

export function buildConfigFromAnswers({
  platformAnswer,
  latestAnswer,
  defaults = DEFAULT_CONFIG,
}) {
  const normalizedPlatformAnswer = platformAnswer.trim();
  const normalizedLatestAnswer = latestAnswer.trim();

  const platforms = normalizedPlatformAnswer
    ? [...new Set(
        normalizedPlatformAnswer
          .split(",")
          .map((value) => Number(value.trim()) - 1)
          .filter((value) => Number.isInteger(value) && value >= 0 && value < PLATFORM_OPTIONS.length)
          .map((index) => PLATFORM_OPTIONS[index].id),
      )]
    : defaults.platforms;

  if (platforms.length === 0) {
    throw new Error("At least one platform must be selected.");
  }

  const latestCount = normalizedLatestAnswer ? Number(normalizedLatestAnswer) : defaults.latestCount;
  if (!Number.isInteger(latestCount) || latestCount <= 0) {
    throw new Error("Latest version count must be a positive integer.");
  }

  return {
    platforms,
    latestCount,
  };
}

export async function promptForConfig({
  input = process.stdin,
  output = process.stdout,
  defaults = DEFAULT_CONFIG,
}) {
  output.write("Configure codex-npm-check\n\n");
  output.write("Target platforms:\n");
  PLATFORM_OPTIONS.forEach((option, index) => {
    output.write(`  ${index + 1}. ${option.label} (${option.id})\n`);
  });

  const platformPrompt =
    `Select platforms (comma-separated numbers) [${selectedIndexes(defaults.platforms)}]: `;
  const latestPrompt =
    `How many latest stable versions should be checked? [${defaults.latestCount}]: `;

  if (!input.isTTY) {
    let buffered = "";
    for await (const chunk of input) {
      buffered += chunk;
    }

    const answers = buffered.split(/\r?\n/);
    while (true) {
      output.write(platformPrompt);
      const platformAnswer = answers.shift() ?? "";
      output.write(latestPrompt);
      const latestAnswer = answers.shift() ?? "";

      try {
        return buildConfigFromAnswers({ platformAnswer, latestAnswer, defaults });
      } catch (error) {
        output.write(`${error.message}\n\n`);
      }
    }
  }

  const rl = readline.createInterface({ input, output });
  const ask = (prompt) =>
    new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

  try {
    while (true) {
      const platformAnswer = await ask(platformPrompt);
      const latestAnswer = await ask(latestPrompt);

      try {
        return buildConfigFromAnswers({ platformAnswer, latestAnswer, defaults });
      } catch (error) {
        output.write(`${error.message}\n\n`);
      }
    }
  } finally {
    rl.close();
  }
}
