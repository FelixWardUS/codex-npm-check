import { checkVersionRelease } from "./checker.js";
import { DEFAULT_CONFIG, deleteConfig, getConfigPath, loadConfig, saveConfig } from "./config.js";
import { getLatestStableVersions } from "./npm.js";
import { PLATFORM_OPTIONS, promptForConfig } from "./prompts.js";

const PLATFORM_IDS = new Set(PLATFORM_OPTIONS.map((option) => option.id));

function usage() {
  return [
    "Usage: ccr [version]",
    "       ccr [version] --platform <platforms> [--latest <count>] [--json]",
    "       ccr --set",
    "       ccr --show",
    "       ccr --reset",
    "",
    "Options:",
    "  --platform <list>  Comma-separated platform IDs for one run",
    "  --latest <count>   Number of latest stable releases to check for one run",
    "  --json             Print machine-readable JSON output",
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

function readOptionValue({ args, index, option }) {
  const arg = args[index];
  const equalsIndex = arg.indexOf("=");

  if (equalsIndex >= 0) {
    return { value: arg.slice(equalsIndex + 1), nextIndex: index };
  }

  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value.`);
  }

  return { value, nextIndex: index + 1 };
}

function parsePlatformList(value) {
  const platforms = [
    ...new Set(
      value
        .split(",")
        .map((platform) => platform.trim())
        .filter(Boolean),
    ),
  ];

  if (platforms.length === 0) {
    throw new Error("At least one platform must be selected.");
  }

  for (const platform of platforms) {
    if (!PLATFORM_IDS.has(platform)) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  return platforms;
}

function parseLatestCount(value) {
  const latestCount = Number(value);
  if (!Number.isInteger(latestCount) || latestCount <= 0) {
    throw new Error("--latest must be a positive integer.");
  }

  return latestCount;
}

function parseArgs(args) {
  const options = {
    help: false,
    set: false,
    show: false,
    reset: false,
    json: false,
    platformOverride: null,
    latestOverride: null,
    positional: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--set") {
      options.set = true;
      continue;
    }

    if (arg === "--show") {
      options.show = true;
      continue;
    }

    if (arg === "--reset") {
      options.reset = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--platform" || arg === "--platforms" || arg.startsWith("--platform=") || arg.startsWith("--platforms=")) {
      const { value, nextIndex } = readOptionValue({ args, index, option: "--platform" });
      options.platformOverride = parsePlatformList(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--latest" || arg.startsWith("--latest=")) {
      const { value, nextIndex } = readOptionValue({ args, index, option: "--latest" });
      options.latestOverride = parseLatestCount(value);
      index = nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    options.positional.push(arg);
  }

  const commandCount = [options.set, options.show, options.reset].filter(Boolean).length;
  if (commandCount > 1) {
    throw new Error("Choose only one command.");
  }

  if (options.positional.length > 1) {
    throw new Error("Only one version can be checked at a time.");
  }

  return options;
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

async function runChecks({ config, explicitVersion = null, json = false }) {
  const versions = explicitVersion
    ? [explicitVersion]
    : await getLatestStableVersions({ count: config.latestCount });

  if (versions.length === 0) {
    throw new Error("No stable Codex versions were found on npm.");
  }

  if (!json) {
    if (explicitVersion) {
      process.stdout.write(`Checking configured platforms for ${explicitVersion}...\n\n`);
    } else {
      process.stdout.write(`Checking latest ${config.latestCount} stable releases...\n\n`);
    }
  }

  let ok = true;
  const results = [];
  for (const version of versions) {
    const result = await checkVersionRelease({
      version,
      platforms: config.platforms,
    });

    results.push(result);
    if (!json) {
      process.stdout.write(`${result.lines.join("\n")}\n\n`);
    }

    if (!result.ok) {
      ok = false;
    }
  }

  if (json) {
    const payload = {
      ok,
      versions: results.map(({ lines, ...result }) => result),
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

export async function main(args) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${message}\n\n${usage()}`);
    process.exitCode = 64;
    return;
  }

  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  if (options.set) {
    const config = await ensureConfig({ forceSetup: true });
    await runChecks({ config, json: options.json });
    return;
  }

  if (options.show) {
    const config = await loadConfig();
    if (!config) {
      process.stdout.write("No saved configuration. Run `ccr` or `ccr --set` first.\n");
      return;
    }

    process.stdout.write(renderConfig(config, getConfigPath()));
    return;
  }

  if (options.reset) {
    await deleteConfig();
    process.stdout.write("Configuration reset.\n");
    return;
  }

  let config;
  if (options.platformOverride) {
    const currentConfig = await loadConfig();
    config = {
      ...(currentConfig ?? DEFAULT_CONFIG),
      platforms: options.platformOverride,
    };
  } else {
    config = await ensureConfig();
  }

  if (options.latestOverride) {
    config = {
      ...config,
      latestCount: options.latestOverride,
    };
  }

  await runChecks({
    config,
    explicitVersion: options.positional[0] ?? null,
    json: options.json,
  });
}
