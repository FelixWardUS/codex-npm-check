import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function errorOutput(error) {
  if (!error || typeof error !== "object") {
    return String(error);
  }

  return [error.stderr, error.stdout, error.message].filter(Boolean).map(String).join("\n");
}

function isMissingPackageError(error) {
  return /\bE404\b|404 Not Found/.test(errorOutput(error));
}

export function summarizeVersionStatus(version, platformStatuses, { mainExists = true } = {}) {
  const lines = [version];
  let ok = mainExists;

  if (!mainExists) {
    lines.push("  main package: missing");
  }

  for (const [platform, status] of Object.entries(platformStatuses)) {
    lines.push(`  ${platform}: ${status ? "OK" : "missing"}`);
    if (!status) {
      ok = false;
    }
  }

  return { ok, lines };
}

async function packageExists(packageSpec, { npmBin = process.env.NPM_BIN || "npm" } = {}) {
  try {
    await execFileAsync(npmBin, ["view", packageSpec, "version"], { encoding: "utf8" });
    return true;
  } catch (error) {
    if (isMissingPackageError(error)) {
      return false;
    }

    const details = errorOutput(error).trim();
    throw new Error(`npm view failed for ${packageSpec}: ${details}`, { cause: error });
  }
}

export async function checkVersionRelease({
  version,
  platforms,
  npmBin = process.env.NPM_BIN || "npm",
}) {
  const mainExists = await packageExists(`@openai/codex@${version}`, { npmBin });
  const platformStatuses = Object.fromEntries(
    await Promise.all(
      platforms.map(async (platform) => [
        platform,
        mainExists ? await packageExists(`@openai/codex@${version}-${platform}`, { npmBin }) : false,
      ]),
    ),
  );

  return {
    version,
    mainExists,
    platformStatuses,
    ...summarizeVersionStatus(version, platformStatuses, { mainExists }),
  };
}
