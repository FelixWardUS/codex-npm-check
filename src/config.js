import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export const DEFAULT_CONFIG = {
  platforms: ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "win32-x64", "win32-arm64"],
  latestCount: 5,
};

export function normalizeConfig(config) {
  if (!config || typeof config !== "object") {
    return { ...DEFAULT_CONFIG };
  }

  const platforms = Array.isArray(config.platforms) && config.platforms.length > 0
    ? [...new Set(config.platforms.map(String))]
    : DEFAULT_CONFIG.platforms;
  const latestCount = Number.isInteger(config.latestCount) && config.latestCount > 0
    ? config.latestCount
    : DEFAULT_CONFIG.latestCount;

  return { platforms, latestCount };
}

export function getConfigBaseDir() {
  if (process.env.CCR_CONFIG_HOME) {
    return process.env.CCR_CONFIG_HOME;
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return xdgConfigHome;
  }

  return path.join(homedir(), ".config");
}

export function getConfigPath({ baseDir = getConfigBaseDir() } = {}) {
  return path.join(baseDir, "ccr", "config.json");
}

export async function loadConfig({ baseDir = getConfigBaseDir() } = {}) {
  const filePath = getConfigPath({ baseDir });

  try {
    await access(filePath);
  } catch {
    return null;
  }

  return normalizeConfig(JSON.parse(await readFile(filePath, "utf8")));
}

export async function saveConfig({ baseDir = getConfigBaseDir(), config }) {
  const filePath = getConfigPath({ baseDir });
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`, "utf8");
}

export async function deleteConfig({ baseDir = getConfigBaseDir() } = {}) {
  const filePath = getConfigPath({ baseDir });
  await rm(filePath, { force: true });
}
