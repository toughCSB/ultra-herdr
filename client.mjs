import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, renameSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { activateWindowsClient } from "./windows-launcher.mjs";
import { activationError, commitFiles, fileChange, linkChange } from "./files.mjs";
import { pluginSettingsPath } from "./font.mjs";

const release = JSON.parse(readFileSync(new URL("./client-release.json", import.meta.url), "utf8"));

export function localClientDirectory(base, {
  config = join(dirname(pluginSettingsPath()), "client-local.json"),
  platform = process.platform, arch = process.arch,
  releaseVersion = release.version, baseVersion = release.baseVersion,
} = {}) {
  if (!existsSync(config)) return null;
  const local = JSON.parse(readFileSync(config, "utf8"));
  if (local.releaseVersion !== releaseVersion || local.baseVersion !== baseVersion
      || local.platform !== platform || local.arch !== arch) return null;
  if (typeof local.directory !== "string" || !/^[\w.-]+$/.test(local.directory) || [".", ".."].includes(local.directory)) {
    throw new Error("Invalid local companion directory");
  }
  const directory = join(base, local.directory);
  const binary = join(directory, platform === "win32" ? "herdr.exe" : "herdr");
  if (!existsSync(binary) || createHash("sha256").update(readFileSync(binary)).digest("hex") !== local.sha256) {
    throw new Error("Local companion SHA256 mismatch; preserve current sessions and rebuild the local companion");
  }
  return directory;
}

export function clientAsset(platform, arch) {
  const asset = release.assets[`${platform}-${arch}`];
  if (!asset) throw new Error(`Companion client does not support ${platform}-${arch}`);
  return asset;
}

export function ghosttyClientConfig(source, binary) {
  const command = `command = direct:${binary}`;
  if (!/^command\s*=/m.test(source)) throw new Error("Herdr launcher has no command");
  return source.replace(/^command\s*=.*$/m, command);
}

export function activateMacClient(base, directory, { launcherPath, io } = {}) {
  const binary = join(directory, "herdr");
  if (!existsSync(binary)) throw new Error("Companion executable is missing");
  const current = join(base, "current");
  // Prepare every text file before selecting the version. The stable pointer is last.
  const changes = launcherPath ? [fileChange(launcherPath, source => {
    if (source === null) throw new Error(`Ghostty launcher not found: ${launcherPath}`);
    return ghosttyClientConfig(source.toString("utf8"), join(current, "herdr"));
  })] : [];
  changes.push(linkChange(current, directory));
  commitFiles(changes, { io });
  if (realpathSync(join(current, "herdr")) !== realpathSync(binary)) throw activationError(["client-pointer"], undefined, "Client");
  return join(current, "herdr");
}

export async function installClient() {
  const asset = clientAsset(process.platform, process.arch);
  const base = process.platform === "win32"
    ? join(process.env.LOCALAPPDATA, "Programs", "ultra-herdr-client")
    : join(homedir(), ".local/share/ultra-herdr-client");
  const directory = localClientDirectory(base) || join(base, `${release.baseVersion}-ultra-${release.version}`);
  const binary = join(directory, process.platform === "win32" ? "herdr.exe" : "herdr");
  if (!existsSync(binary)) {
    mkdirSync(base, { recursive: true });
    const response = await fetch(`https://github.com/toughCSB/ultra-herdr/releases/download/v${release.version}/${asset.file}`);
    if (!response.ok) throw new Error(`Client download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
      throw new Error("Client archive SHA256 does not match the release");
    }
    const archive = join(base, asset.file);
    writeFileSync(archive, bytes);
    const staging = `${directory}.install-${process.pid}`;
    mkdirSync(staging);
    if (process.platform === "win32") {
      execFileSync("powershell.exe", [
        "-NoProfile", "-EncodedCommand",
        Buffer.from(`Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${staging.replaceAll("'", "''")}'`, "utf16le").toString("base64"),
      ], { windowsHide: true });
    } else {
      execFileSync("tar", ["-xzf", archive, "-C", staging]);
      chmodSync(join(staging, "herdr"), 0o755);
    }
    if (!existsSync(join(staging, process.platform === "win32" ? "herdr.exe" : "herdr"))) {
      throw new Error("Companion archive has no executable");
    }
    renameSync(staging, directory);
  }
  if (process.platform === "win32") {
    activateWindowsClient(base, binary);
  } else {
    activateMacClient(base, directory, {
      launcherPath: join(homedir(), ".local/share/herdr-launcher/herdr.ghostty"),
    });
  }
  return binary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Companion installed: ${await installClient()}. Reopen the Herdr client window; server and sessions are unchanged.`);
}
