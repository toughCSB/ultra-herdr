import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { test } from "node:test";
import { activateMacClient } from "./client.mjs";
import { activateWindowsClient } from "./windows-launcher.mjs";

function fixture(t) {
  const base = fs.mkdtempSync(join(tmpdir(), "ultra-activate-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const binary = join(base, "new", "herdr.exe");
  const old = join(base, "old", "herdr.exe");
  const terminalPath = join(base, "terminal.json");
  const profilePath = join(base, "profile.ps1");
  const pointer = join(base, "current-client.json");
  for (const path of [binary, old]) { fs.mkdirSync(dirname(path)); fs.writeFileSync(path, "fixture"); }
  fs.writeFileSync(terminalPath, '{"profiles":{"list":[{"name":"Herdr","commandline":"old","font":{"size":11},"background":"keep"},{"name":"other","keep":true}]}}');
  fs.writeFileSync(profilePath, "# personal configuration\n");
  fs.writeFileSync(pointer, JSON.stringify({ binary: old }));
  const calls = [];
  const run = (command, args) => { calls.push({ command, args }); return args.includes("-EncodedCommand") ? "" : profilePath; };
  return { base, binary, old, terminalPath, profilePath, pointer, calls, options: { terminalPath, run } };
}

for (const invalid of ['{"profiles":{"list":[]}}', '{invalid']) test("Windows profile preparation rejects invalid state before pointer or hook changes: " + invalid, t => {
  const f = fixture(t);
  fs.writeFileSync(f.terminalPath, invalid);
  assert.throws(() => activateWindowsClient(f.base, f.binary, f.options));
  assert.equal(JSON.parse(fs.readFileSync(f.pointer)).binary, f.old);
  assert.equal(fs.existsSync(join(f.base, "launch-herdr.ps1")), false);
  assert.equal(fs.readFileSync(f.profilePath, "utf8"), "# personal configuration\n");
  assert.equal(f.calls.length, 0);
});

test("Windows mid-write failure recovers hooks and terminal; retry selects one version", t => {
  const f = fixture(t);
  const before = fs.readFileSync(f.terminalPath, "utf8");
  let fail = true;
  const io = { ...fs, renameSync(from, to) {
    if (to === f.terminalPath && fail) { fail = false; throw new Error("fixture write failure"); }
    fs.renameSync(from, to);
  } };
  assert.throws(() => activateWindowsClient(f.base, f.binary, { ...f.options, io }), /fixture write failure/);
  assert.equal(JSON.parse(fs.readFileSync(f.pointer)).binary, f.old);
  assert.equal(fs.readFileSync(f.terminalPath, "utf8"), before);
  assert.equal(fs.readFileSync(f.profilePath, "utf8"), "# personal configuration\n");
  assert.equal(fs.existsSync(join(f.base, "launch-herdr.ps1")), false);
  activateWindowsClient(f.base, f.binary, { ...f.options, io });
  const terminal = JSON.parse(fs.readFileSync(f.terminalPath));
  assert.equal(terminal.profiles.list[0].commandline, `"${f.binary}" --session default`);
  assert.equal(terminal.profiles.list[0].font.size, 11);
  assert.equal(terminal.profiles.list[0].background, "keep");
  assert.deepEqual(terminal.profiles.list[1], { name: "other", keep: true });
  assert.equal(JSON.parse(fs.readFileSync(f.pointer)).binary, f.binary);
  assert.match(fs.readFileSync(f.profilePath, "utf8"), /^# personal configuration/);
  activateWindowsClient(f.base, f.binary, f.options);
  assert.equal(fs.readFileSync(f.profilePath, "utf8").match(/function global:herdr/g).length, 1);
});

test("Windows shortcut failure reports committed activation and remains retryable", t => {
  const f = fixture(t);
  const run = (command, args) => { if (args.includes("-EncodedCommand")) throw new Error("COM unavailable"); return f.profilePath; };
  assert.throws(() => activateWindowsClient(f.base, f.binary, { ...f.options, run }), error => error.persisted && error.failed.includes("shortcut"));
  assert.equal(JSON.parse(fs.readFileSync(f.pointer)).binary, f.binary);
  assert.equal(JSON.parse(fs.readFileSync(f.terminalPath)).profiles.list[0].commandline, `"${f.binary}" --session default`);
  activateWindowsClient(f.base, f.binary, f.options);
});

test("Mac pointer rename failure restores launcher and cleans staging before retry", { skip: process.platform === "win32" }, t => {
  const f = fixture(t);
  const current = join(f.base, "current");
  for (const name of ["old", "new"]) fs.writeFileSync(join(f.base, name, "herdr"), name);
  fs.symlinkSync(join(f.base, "old"), current, "dir");
  const launcherPath = join(f.base, "herdr.ghostty");
  const oldLauncher = "command = direct:/old/herdr\nfont-size = 14\n";
  fs.writeFileSync(launcherPath, oldLauncher);
  let fail = true;
  const io = { ...fs, renameSync(from, to) {
    if (to === current && fail) { fail = false; throw new Error("fixture pointer failure"); }
    fs.renameSync(from, to);
  } };
  assert.throws(() => activateMacClient(f.base, join(f.base, "new"), { launcherPath, io }), /fixture pointer failure/);
  assert.equal(fs.readlinkSync(current), join(f.base, "old"));
  assert.equal(fs.readFileSync(launcherPath, "utf8"), oldLauncher);
  assert.ok(fs.readdirSync(f.base).every(name => !name.includes(".ultra-herdr-")));
  const stable = activateMacClient(f.base, join(f.base, "new"), { launcherPath, io });
  assert.equal(fs.readFileSync(stable, "utf8"), "new");
  assert.match(fs.readFileSync(launcherPath, "utf8"), /current\/herdr/);
});
