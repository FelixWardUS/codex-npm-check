import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
const OFFICIAL_NPM_ARGS = [
  "--registry",
  OFFICIAL_REGISTRY,
  `--@openai:registry=${OFFICIAL_REGISTRY}`,
];

function errorOutput(error) {
  if (!error || typeof error !== "object") {
    return String(error);
  }

  return [error.stderr, error.stdout, error.message].filter(Boolean).map(String).join("\n");
}

export function normalizeRegistryUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return null;
  }

  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }
    return url.toString();
  } catch {
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }
}

export function sameRegistry(left, right) {
  const normalizedLeft = normalizeRegistryUrl(left);
  const normalizedRight = normalizeRegistryUrl(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

async function npmConfigGet(key, { npmBin = process.env.NPM_BIN || "npm" } = {}) {
  try {
    const { stdout } = await execFileAsync(npmBin, ["config", "get", key], {
      encoding: "utf8",
    });
    return stdout.trim();
  } catch (error) {
    const details = errorOutput(error).trim();
    throw new Error(`npm config failed for ${key}: ${details}`, { cause: error });
  }
}

async function configuredRegistry({ npmBin = process.env.NPM_BIN || "npm" } = {}) {
  const scopedRegistry = normalizeRegistryUrl(await npmConfigGet("@openai:registry", { npmBin }));
  if (scopedRegistry) {
    return scopedRegistry;
  }

  return normalizeRegistryUrl(await npmConfigGet("registry", { npmBin })) ?? OFFICIAL_REGISTRY;
}

export async function getRegistrySources({ npmBin = process.env.NPM_BIN || "npm" } = {}) {
  const registry = await configuredRegistry({ npmBin });
  if (sameRegistry(registry, OFFICIAL_REGISTRY)) {
    return [{ id: "official", registry, npmArgs: [] }];
  }

  return [
    { id: "configured", registry, npmArgs: [] },
    { id: "official", registry: OFFICIAL_REGISTRY, npmArgs: OFFICIAL_NPM_ARGS },
  ];
}
