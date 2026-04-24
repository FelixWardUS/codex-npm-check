import { checkVersionRelease } from "./checker.js";
import { deleteConfig, getConfigPath, loadConfig, saveConfig } from "./config.js";
import { getLatestStableVersions } from "./npm.js";
import { promptForConfig } from "./prompts.js";

function usage() {
  return [
    "Usage: ccr [version]",
    "       ccr --set",
    "       ccr --show",
    "       ccr --reset",
    "",
    "Commands:",
    "  ccr         Run checks using saved configuration",
    "  ccr 0.124.0 Check one specific Codex version with saved platforms",
    "  ccr --set   Update saved platforms and latest-version count",
    "  ccr --show  Print current configuration",
    "  ccr --reset Delete current configuration",
    "",
  ].join("\n");
}

function renderConfig(config, configPath) {
  const lines = [
    `Config: ${configPath}`,
    "Platforms:",
    ...config.platforms.map((platform) => `  - ${platform}`),
    `Latest stable versions: ${config.latestCount}`,
    "",
  ];

  return lines.join("\n");
}

async function configure({ existingConfig = null } = {}) {
  const defaults = existingConfig ?? undefined;
  const config = await promptForConfig({ defaults });
  await saveConfig({ config });
  process.stdout.write(`Saved config to ${getConfigPath()}\n\n`);
  return config;
}

async function ensureConfig({ forceSetup = false } = {}) {
  const currentConfig = forceSetup ? await loadConfig() : await loadConfig();
  if (!currentConfig || forceSetup) {
    return configure({ existingConfig: currentConfig });
  }

  return currentConfig;
}

async function runChecks({ config, explicitVersion = null }) {
  const versions = explicitVersion
    ? [explicitVersion]
    : await getLatestStableVersions({ count: config.latestCount });

  if (versions.length === 0) {
    throw new Error("No stable Codex versions were found on npm.");
  }

  if (explicitVersion) {
    process.stdout.write(`Checking configured platforms for ${explicitVersion}...\n\n`);
  } else {
    process.stdout.write(`Checking latest ${config.latestCount} stable releases...\n\n`);
  }

  let ok = true;
  for (const version of versions) {
    const result = await checkVersionRelease({
      version,
      platforms: config.platforms,
    });

    process.stdout.write(`${result.lines.join("\n")}\n\n`);
    if (!result.ok) {
      ok = false;
    }
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

export async function main(args) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage());
    return;
  }

  if (args.includes("--set")) {
    const config = await ensureConfig({ forceSetup: true });
    await runChecks({ config });
    return;
  }

  if (args.includes("--show")) {
    const config = await loadConfig();
    if (!config) {
      process.stdout.write("No saved configuration. Run `ccr` or `ccr -set` first.\n");
      return;
    }

    process.stdout.write(renderConfig(config, getConfigPath()));
    return;
  }

  if (args.includes("--reset")) {
    await deleteConfig();
    process.stdout.write("Configuration reset.\n");
    return;
  }

  const unknownOptions = args.filter(
    (arg) =>
      arg.startsWith("-") &&
      !["--help", "-h", "--set", "--show", "--reset"].includes(arg),
  );
  if (unknownOptions.length > 0) {
    process.stdout.write(usage());
    process.exitCode = 64;
    return;
  }

  const positional = args.filter((arg) => !arg.startsWith("-"));
  if (positional.length > 1) {
    process.stdout.write(usage());
    process.exitCode = 64;
    return;
  }

  const config = await ensureConfig();
  await runChecks({ config, explicitVersion: positional[0] ?? null });
}
