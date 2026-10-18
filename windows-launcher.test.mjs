import assert from "node:assert/strict";
import { test } from "node:test";
import { interactiveProfile, windowsLaunchScript } from "./windows-launcher.mjs";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("the PowerShell hook updates once and preserves user profile content", () => {
  const original = '# user settings\n$env:MY_SETTING = "keep"\n';
  const first = interactiveProfile(original, "C:\\old\\launch-herdr.ps1");
  const second = interactiveProfile(first, "C:\\new\\launch-herdr.ps1");
  assert.ok(second.startsWith(original));
  assert.equal(second.match(/function global:herdr/g).length, 1);
  assert.ok(second.includes("C:\\new\\launch-herdr.ps1"));
  assert.equal(interactiveProfile(second, "C:\\new\\launch-herdr.ps1"), second);
  assert.ok(interactiveProfile("", "C:\\it's\\launch.ps1").includes("it''s"));
});

test("launcher script uses a stable pointer and keeps official CLI commands", () => {
  const script = windowsLaunchScript("C:\\it's\\current-client.json");
  assert.ok(script.includes("it''s"));
  assert.ok(script.includes("Get-Command herdr.exe -CommandType Application"));
  assert.ok(script.includes("$launchArgs.Count -eq 2"));
});

test("Windows launcher requires explicit server stop confirmation and preserves API routing", { skip: process.platform !== "win32" }, () => {
  const root = mkdtempSync(join(tmpdir(), "ultra-stop-guard-"));
  const psQuote = s => "'" + s.replaceAll("'", "''") + "'";
  const marker = join(root, "called.json"), fake = join(root, "official.ps1");
  const launcher = join(root, "launcher.ps1"), harness = join(root, "harness.ps1");
  try {
    writeFileSync(fake, `$args | ConvertTo-Json | Set-Content -LiteralPath ${psQuote(marker)} -Encoding UTF8; exit 0`);
    writeFileSync(launcher, windowsLaunchScript(join(root, "unused.json")));
    writeFileSync(harness, `function global:Get-Command { [CmdletBinding()] param($Name,$CommandType) [pscustomobject]@{Source=${psQuote(fake)}} }\n& ${psQuote(launcher)} @args`);
    const powershell = join(process.env.WINDIR, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const env = { ...process.env, PATH: root, Path: root };
    const run = args => spawnSync(powershell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harness, ...args], { env, windowsHide: true, encoding: "utf8" });
    const sent = () => {
      const value = JSON.parse(readFileSync(marker, "utf8").replace(/^\uFEFF/, ""));
      return Array.isArray(value) ? value : value.value;
    };
    assert.notEqual(run(["--session", "default", "server", "stop"]).status, 0);
    assert.equal(existsSync(marker), false);
    assert.equal(run(["--session", "default", "server", "stop", "--confirm-server-stop"]).status, 0);
    assert.deepEqual(sent(), ["--session", "default", "server", "stop"]);
    assert.equal(run(["api", "snapshot"]).status, 0);
    assert.deepEqual(sent(), ["api", "snapshot"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
