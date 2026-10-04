import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, renameSync, lstatSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { terminalJson, terminalSettingsPath } from "./font.mjs";

const release = JSON.parse(readFileSync(new URL("./client-release.json", import.meta.url), "utf8"));

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

export function activateMacClient(base, directory) {
  const binary = join(directory, "herdr");
  if (!existsSync(binary)) throw new Error("Companion executable is missing");
  const current = join(base, "current");
  try {
    if (!lstatSync(current).isSymbolicLink()) throw new Error("Companion current path is not a symlink");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = `${current}.activate-${process.pid}`;
  symlinkSync(directory, temporary, "dir");
  renameSync(temporary, current);
  return join(current, "herdr");
}

export async function installClient() {
  const asset = clientAsset(process.platform, process.arch);
  const base = process.platform === "win32"
    ? join(process.env.LOCALAPPDATA, "Programs", "ultra-herdr-client")
    : join(homedir(), ".local/share/ultra-herdr-client");
  const directory = join(base, `0.9.1-ultra-${release.version}`);
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
    const path = terminalSettingsPath();
    const settings = terminalJson(readFileSync(path, "utf8"));
    const profile = settings.profiles.list.find(item => item.name === "Herdr");
    if (!profile) throw new Error("Windows Terminal has no Herdr profile");
    profile.commandline = `"${binary}" --session default`;
    writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
    const script = [
      "$w = New-Object -ComObject WScript.Shell",
      "$p = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Herdr.lnk'",
      `if (Test-Path $p) { $s = $w.CreateShortcut($p); $s.Arguments = '-w new nt -p Herdr --title Herdr -- "${binary.replaceAll("'", "''")}" --session default'; $s.Save() }`,
    ].join("; ");
    execFileSync("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true });
  } else {
    const launcher = join(homedir(), ".local/share/herdr-launcher/herdr.ghostty");
    // Ghostty can retain its command across new windows. Keep that command stable
    // while atomically selecting the installed version for future launches.
    const current = activateMacClient(base, directory);
    writeFileSync(launcher, ghosttyClientConfig(readFileSync(launcher, "utf8"), current));
  }
  return binary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Companion installed: ${await installClient()}. Reopen the Herdr client window; server and sessions are unchanged.`);
}
