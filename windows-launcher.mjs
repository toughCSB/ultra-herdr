import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const begin = "# >>> ultra-herdr interactive client";
const end = "# <<< ultra-herdr interactive client";
const quote = value => `'${value.replaceAll("'", "''")}'`;

export function interactiveProfile(source, script) {
  const block = `${begin}\nif ([System.Diagnostics.Process]::GetCurrentProcess().SessionId -ne 0 -and -not $env:SSH_CONNECTION) {\n  function global:herdr { & ${quote(script)} @args }\n}\n${end}`;
  const managed = /^# >>> ultra-herdr interactive client\r?\n[\s\S]*?^# <<< ultra-herdr interactive client/m;
  if (managed.test(source)) return source.replace(managed, () => block);
  return `${source}${source.endsWith("\n") || !source ? "" : "\n"}${block}\n`;
}

export function windowsLaunchScript(pointer) {
  return `$ErrorActionPreference = 'Stop'
$launchArgs = @($args)
if ($launchArgs.Count -eq 0 -or ($launchArgs.Count -eq 2 -and $launchArgs[0] -eq '--session')) {
  $client = (Get-Content -LiteralPath ${quote(pointer)} -Raw -Encoding UTF8 | ConvertFrom-Json).binary
  if (-not $client -or -not (Test-Path -LiteralPath $client -PathType Leaf)) { throw 'Ultra Herdr companion is missing; reinstall local.ultra-herdr' }
  if ($launchArgs.Count -eq 0) { $launchArgs = @('--session', 'default') }
  & $client @launchArgs
} else {
  # Keep API, server, bridge and update commands on the official installation.
  $official = (Get-Command herdr.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  & $official @launchArgs
}
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
`;
}

function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.ultra-herdr-${process.pid}`;
  writeFileSync(temporary, contents);
  renameSync(temporary, path);
}

export function activateWindowsClient(base, binary) {
  if (!existsSync(binary)) throw new Error("Companion executable is missing");
  const script = join(base, "launch-herdr.ps1");
  atomicWrite(script, windowsLaunchScript(join(base, "current-client.json")));
  atomicWrite(join(base, "current-client.json"), `${JSON.stringify({ binary })}\n`);
  const profiles = new Set();
  for (const shell of ["powershell.exe", "pwsh.exe"]) {
    try {
      const output = execFileSync(shell, ["-NoProfile", "-Command", "$PROFILE.CurrentUserAllHosts"], { encoding: "utf8", windowsHide: true });
      profiles.add(output.trim());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const path of profiles) {
    if (!path) throw new Error("PowerShell returned no profile path");
    const original = existsSync(path) ? readFileSync(path, "utf8") : "";
    const updated = interactiveProfile(original, script);
    if (updated === original) continue;
    if (existsSync(path)) {
      if (readFileSync(path, "utf8") !== original) throw new Error("PowerShell profile changed while installing client");
      const backup = `${path}.ultra-herdr-backup-${Date.now()}`;
      writeFileSync(backup, original, { flag: "wx" });
    }
    atomicWrite(path, updated);
  }
  return script;
}
