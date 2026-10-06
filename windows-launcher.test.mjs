import assert from "node:assert/strict";
import { test } from "node:test";
import { interactiveProfile, windowsLaunchScript } from "./windows-launcher.mjs";

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
