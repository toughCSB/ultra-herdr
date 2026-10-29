import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { terminalJson, terminalSettingsPath } from "./font.mjs";
import { activationError, commitFiles, fileChange } from "./files.mjs";

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
$serverIndex = [Array]::IndexOf($launchArgs, 'server')
if ($serverIndex -ge 0 -and $launchArgs.Count -gt ($serverIndex + 1) -and $launchArgs[$serverIndex + 1] -eq 'stop') {
  if ($launchArgs -notcontains '--confirm-server-stop') {
    Write-Error 'Server stop ends ALL running sessions. Close and reopen the Herdr client window instead. To intentionally stop the server, repeat with --confirm-server-stop.'
    exit 2
  }
  $launchArgs = @($launchArgs | Where-Object { $_ -ne '--confirm-server-stop' })
}
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

export function prepareWindowsClient(base, binary, {
  terminalPath = terminalSettingsPath(), run = execFileSync,
} = {}) {
  if (!existsSync(binary)) throw new Error("Companion executable is missing");
  // Missing/corrupt profiles fail before pointer, hooks, or shortcuts are changed.
  const terminal = fileChange(terminalPath, source => {
    if (source === null) throw new Error(`Windows Terminal config not found: ${terminalPath}`);
    const settings = terminalJson(source.toString("utf8"));
    const profile = Array.isArray(settings.profiles?.list) && settings.profiles.list.find(item => item.name === "Herdr");
    if (!profile) throw new Error("Windows Terminal has no Herdr profile");
    profile.commandline = `"${binary}" --session default`;
    return `${JSON.stringify(settings, null, 2)}\n`;
  });
  const script = join(base, "launch-herdr.ps1");
  const pointer = join(base, "current-client.json");
  const changes = [fileChange(script, windowsLaunchScript(pointer))];
  const profiles = new Set();
  for (const shell of ["powershell.exe", "pwsh.exe"]) {
    try {
      const output = run(shell, ["-NoProfile", "-Command", "$PROFILE.CurrentUserAllHosts"], { encoding: "utf8", windowsHide: true, timeout: 20000 });
      if (!output.trim()) throw new Error("PowerShell returned no profile path");
      profiles.add(output.trim());
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  for (const path of profiles) {
    const change = fileChange(path, source => interactiveProfile(source?.toString("utf8") || "", script));
    if (change.original?.equals(change.updated)) continue;
    if (change.original !== null) changes.push(fileChange(`${path}.ultra-herdr-backup-${randomUUID()}`, change.original));
    changes.push(change);
  }
  changes.push(terminal, fileChange(pointer, `${JSON.stringify({ binary })}\n`));
  return { changes, script, pointer };
}

export function activateWindowsClient(base, binary, options = {}) {
  const { run = execFileSync } = options;
  const plan = prepareWindowsClient(base, binary, options);
  commitFiles(plan.changes, { io: options.io });
  if (JSON.parse(readFileSync(plan.pointer, "utf8")).binary !== binary) throw activationError(["client-pointer"], undefined, "Client");
  // Shortcuts are an external COM effect; report failure after committed activation.
  const shortcut = [
    "$ErrorActionPreference = 'Stop'",
    "$w = New-Object -ComObject WScript.Shell",
    "$p = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Herdr.lnk'",
    `if (Test-Path -LiteralPath $p) { $s = $w.CreateShortcut($p); $expected = ${quote('-w new nt -p Herdr --title Herdr -- "'+binary+'" --session default')}; $s.Arguments = $expected; $s.Save(); if ($w.CreateShortcut($p).Arguments -ne $expected) { throw 'Herdr shortcut verification failed' } }`,
  ].join("; ");
  try {
    run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(shortcut, "utf16le").toString("base64")], { windowsHide: true, timeout: 20000 });
  } catch (cause) { throw activationError(["shortcut"], cause, "Client"); }
  return plan.script;
}
