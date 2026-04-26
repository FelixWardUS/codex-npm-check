import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRegistrySources } from "./registries.js";

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

function isHttpTarballError(error) {
  return /\bnpm error (?:code E[45]\d{2}|[45]\d{2})\b/.test(errorOutput(error));
}

function shouldRetryWithNpm(status) {
  return status === 401 || status === 403 || status === 407;
}

function packageStatus({
  metadataExists,
  tarballUrl = null,
  tarballAvailable = false,
  reason = null,
  tarballError = null,
  registries = null,
}) {
  const hasMetadata = metadataExists === true;
  const hasTarball = tarballAvailable === true;
  const ok = hasMetadata && hasTarball;
  const status = {
    metadataExists: hasMetadata,
    tarballUrl: tarballUrl || null,
    tarballAvailable: hasTarball,
    ok,
    reason: ok ? null : (reason ?? (hasMetadata ? "tarball unavailable" : "metadata missing")),
  };

  if (tarballError) {
    status.tarballError = tarballError;
  }

  if (registries) {
    status.registries = registries;
  }

  return status;
}

function normalizePackageStatus(status) {
  if (status && typeof status === "object") {
    return packageStatus(status);
  }

  return status
    ? packageStatus({ metadataExists: true, tarballAvailable: true })
    : packageStatus({
        metadataExists: false,
        tarballAvailable: false,
        reason: "metadata missing",
      });
}

function formatPackageStatus(status) {
  const normalized = normalizePackageStatus(status);
  if (!normalized.ok && hasMultipleRegistries(normalized)) {
    return "issues found ❌";
  }

  return normalized.ok ? "OK ✅" : `${normalized.reason ?? "tarball unavailable"} ❌`;
}

function hasMultipleRegistries(status) {
  return status.registries && Object.keys(status.registries).length > 1;
}

function registryDetailLines(status, indent) {
  const normalized = normalizePackageStatus(status);
  if (normalized.ok || !hasMultipleRegistries(normalized)) {
    return [];
  }

  return Object.entries(normalized.registries).map(
    ([registry, registryStatus]) => `${indent}${registry}: ${formatPackageStatus(registryStatus)}`,
  );
}

export function summarizeVersionStatus(
  version,
  platformStatuses,
  { mainExists = true, mainPackageStatus = null } = {},
) {
  const normalizedMainStatus = normalizePackageStatus(mainPackageStatus ?? mainExists);
  const normalizedPlatformStatuses = Object.fromEntries(
    Object.entries(platformStatuses).map(([platform, status]) => [
      platform,
      normalizePackageStatus(status),
    ]),
  );
  const ok =
    normalizedMainStatus.ok &&
    Object.values(normalizedPlatformStatuses).every((status) => status.ok);
  const lines = [`${version}: ${ok ? "OK ✅" : "issues found ❌"}`];

  lines.push(`  main package: ${formatPackageStatus(normalizedMainStatus)}`);
  lines.push(...registryDetailLines(normalizedMainStatus, "    "));

  for (const [platform, status] of Object.entries(normalizedPlatformStatuses)) {
    lines.push(`  ${platform}: ${formatPackageStatus(status)}`);
    lines.push(...registryDetailLines(status, "    "));
  }

  return { ok, lines };
}

async function npmView(
  packageSpec,
  field,
  { npmBin = process.env.NPM_BIN || "npm", npmArgs = [], registryLabel = null } = {},
) {
  const args = ["view", packageSpec, field, ...npmArgs];

  try {
    const { stdout } = await execFileAsync(npmBin, args, { encoding: "utf8" });
    return stdout.trim();
  } catch (error) {
    if (isMissingPackageError(error)) {
      return null;
    }

    const details = errorOutput(error).trim();
    const registryDetails = registryLabel ? ` using ${registryLabel}` : "";
    throw new Error(`npm view failed for ${packageSpec}${registryDetails}: ${details}`, {
      cause: error,
    });
  }
}

async function closeResponseBody(response) {
  if (response.body && typeof response.body.cancel === "function") {
    try {
      await response.body.cancel();
    } catch {
      // The availability decision only depends on the response status.
    }
  }
}

async function fetchTarball(url, method, { headers = {} } = {}) {
  try {
    const response = await fetch(url, { method, headers });
    await closeResponseBody(response);
    return { ok: response.ok, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

async function httpTarballAvailable(url) {
  const headResult = await fetchTarball(url, "HEAD");
  if (headResult.ok) {
    return { available: true };
  }

  const getResult = await fetchTarball(url, "GET", {
    headers: {
      range: "bytes=0-0",
    },
  });
  if (getResult.ok) {
    return { available: true };
  }

  if (getResult.error) {
    return {
      available: false,
      reason: "tarball fetch failed",
      error: getResult.error,
      retryWithNpm: true,
    };
  }

  return {
    available: false,
    reason: "tarball unavailable",
    retryWithNpm: shouldRetryWithNpm(getResult.status),
  };
}

async function npmTarballAvailable(url, { npmBin = process.env.NPM_BIN || "npm" } = {}) {
  try {
    await execFileAsync(npmBin, ["cache", "add", url, "--prefer-online"], { encoding: "utf8" });
    return { available: true };
  } catch (error) {
    if (isHttpTarballError(error)) {
      return { available: false, reason: "tarball unavailable" };
    }

    return {
      available: false,
      reason: "tarball fetch failed",
      error: errorOutput(error).trim() || "npm tarball fetch failed",
    };
  }
}

async function tarballAvailable(url, { npmBin = process.env.NPM_BIN || "npm" } = {}) {
  if (!url) {
    return { available: false, reason: "tarball unavailable" };
  }

  const httpResult = await httpTarballAvailable(url);
  if (httpResult.available || !httpResult.retryWithNpm) {
    return httpResult;
  }

  return npmTarballAvailable(url, { npmBin });
}

async function checkPackageRelease(
  packageSpec,
  { npmBin = process.env.NPM_BIN || "npm", source = null } = {},
) {
  const npmArgs = source?.npmArgs ?? [];
  const registryLabel = source?.registry ?? null;
  const version = await npmView(packageSpec, "version", { npmBin, npmArgs, registryLabel });
  if (version === null) {
    return packageStatus({
      metadataExists: false,
      tarballUrl: null,
      tarballAvailable: false,
      reason: "metadata missing",
    });
  }

  const tarballUrl = await npmView(packageSpec, "dist.tarball", {
    npmBin,
    npmArgs,
    registryLabel,
  });
  const tarball = await tarballAvailable(tarballUrl, { npmBin });

  return packageStatus({
    metadataExists: true,
    tarballUrl,
    tarballAvailable: tarball.available,
    reason: tarball.reason,
    tarballError: tarball.error,
  });
}

function combineRegistryStatuses(entries) {
  const registries = Object.fromEntries(
    entries.map(([registry, status]) => [registry, normalizePackageStatus(status)]),
  );

  if (entries.length === 1) {
    const onlyStatus = Object.values(registries)[0];
    return packageStatus({
      ...onlyStatus,
      registries,
    });
  }

  const statuses = Object.values(registries);
  const ok = statuses.every((status) => status.ok);
  const metadataExists = statuses.every((status) => status.metadataExists);
  const tarballAvailable = statuses.every((status) => status.tarballAvailable);
  const primaryStatus = registries.configured ?? registries.official ?? statuses[0];

  return packageStatus({
    metadataExists,
    tarballUrl: tarballAvailable ? primaryStatus.tarballUrl : null,
    tarballAvailable,
    reason: ok ? null : "registry issues found",
    registries,
  });
}

async function checkPackageReleaseAcrossRegistries(
  packageSpec,
  { npmBin = process.env.NPM_BIN || "npm", sources },
) {
  const entries = await Promise.all(
    sources.map(async (source) => [
      source.id,
      await checkPackageRelease(packageSpec, { npmBin, source }),
    ]),
  );

  return combineRegistryStatuses(entries);
}

export async function checkVersionRelease({
  version,
  platforms,
  npmBin = process.env.NPM_BIN || "npm",
}) {
  const sources = await getRegistrySources({ npmBin });
  const mainPackageStatus = await checkPackageReleaseAcrossRegistries(`@openai/codex@${version}`, {
    npmBin,
    sources,
  });
  const platformStatuses = Object.fromEntries(
    await Promise.all(
      platforms.map(async (platform) => [
        platform,
        await checkPackageReleaseAcrossRegistries(`@openai/codex@${version}-${platform}`, {
          npmBin,
          sources,
        }),
      ]),
    ),
  );

  return {
    version,
    mainExists: mainPackageStatus.metadataExists,
    mainPackageStatus,
    platformStatuses,
    ...summarizeVersionStatus(version, platformStatuses, { mainPackageStatus }),
  };
}
