import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { applyPalette, applyCurrentTheme } from "./apply.mjs";
import { commitFiles, fileChange } from "./files.mjs";

function fixture(t, platform = "darwin") {
  const home = fs.mkdtempSync(join(tmpdir(), "ultra-apply-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const configPath = join(home, "herdr", "config.toml");
  const settingsPath = join(home, "plugin", "settings.json");
  const terminalPath = join(home, "terminal");
  const agentDir = join(home, ".omo", "agent");
  const markdownPaths = { sidebar: join(home, "sidebar.json"), glow: join(home, "glow.yml") };
  const sidebarStatus = join(dirname(configPath), "plugins/config/local.ultra-herdr/sidebar-status.json");
  const originals = new Map([
    [configPath, fs.readFileSync(new URL("./examples/herdr-config.example.toml", import.meta.url), "utf8")],
    [settingsPath, '{"theme":"blue","fontSize":14,"keep":true}\n'],
    [terminalPath, platform === "darwin" ? "command = direct:keep\nfont-size = 14\nbackground = #000000\n" : '{"profiles":{"list":[{"name":"Herdr","commandline":"keep"}]}}'],
    [join(agentDir, "settings.json"), '{"theme":"herdr-contrast","model":"keep"}'],
    [join(agentDir, "themes/herdr-contrast.json"), '{"name":"old"}'],
    [markdownPaths.sidebar, '{"colors":"vscode","keep":true}'],
    [markdownPaths.glow, 'style: "dark"\nwidth: 100\n'],
    [sidebarStatus, '{"version":2,"old":true}'],
  ]);
  for (const [path, content] of originals) { fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, content); }
  const calls = [];
  const run = (command, args, options) => { calls.push({ command, args, options }); return command === "osascript" ? "1" : ""; };
  const options = { home, platform, environment: { HERDR_BIN_PATH: "fixture-herdr" }, configPath, settingsPath, terminalPath, agentDir, markdownPaths, run };
  return { home, originals, options, calls, configPath, settingsPath, terminalPath, sidebarStatus, agentDir, markdownPaths,
    unchanged() { for (const [path, content] of originals) assert.equal(fs.readFileSync(path, "utf8"), content, path); },
  };
}

for (const failure of ["ghostty", "config-check"]) test(`${failure} validation failure leaves every theme file unchanged`, t => {
  const f = fixture(t);
  const run = (command, args, options) => {
    assert.equal(fs.readFileSync(f.configPath, "utf8"), f.originals.get(f.configPath));
    if (command === "fixture-herdr") assert.match(fs.readFileSync(options.env.HERDR_CONFIG_PATH, "utf8"), /#fffafa/);
    if (command === failure || failure === "config-check" && args[0] === "config") throw new Error("injected validation failure");
    return "1";
  };
  assert.throws(() => applyPalette("pink", 14, { ...f.options, run }), /injected validation failure/);
  f.unchanged();
  assert.ok(fs.readdirSync(f.home, { recursive: true }).every(path => !path.includes(".ultra-herdr-")));
});

test("a mid-commit write failure restores earlier files and a retry succeeds", t => {
  const f = fixture(t);
  let fail = true;
  const io = { ...fs, renameSync(from, to) { if (to === f.settingsPath && fail) { fail = false; throw new Error("injected write failure"); } fs.renameSync(from, to); } };
  assert.throws(() => applyPalette("pink", 14, { ...f.options, io }), /injected write failure/);
  f.unchanged();
  applyPalette("pink", 14, { ...f.options, io });
  assert.equal(JSON.parse(fs.readFileSync(f.settingsPath)).theme, "pink");
  assert.match(fs.readFileSync(f.terminalPath, "utf8"), /#fffafa/);
});

test("rollback preserves an external edit and reports incomplete recovery", t => {
  const f = fixture(t);
  let fail = true;
  const io = { ...fs, renameSync(from, to) {
    if (to === f.settingsPath && fail) { fail = false; fs.writeFileSync(f.configPath, "external edit"); throw new Error("injected write failure"); }
    fs.renameSync(from, to);
  } };
  assert.throws(() => applyPalette("pink", 14, { ...f.options, io }), /Recovery conflict/);
  assert.equal(fs.readFileSync(f.configPath, "utf8"), "external edit");
  assert.equal(fs.readFileSync(f.terminalPath, "utf8"), f.originals.get(f.terminalPath));
});

test("no open GUI still saves all viewers, attempts other activation, and can retry", async t => {
  const f = fixture(t);
  let windows = "0";
  const activated = [];
  const options = { ...f.options,
    run(command, args, opts) { f.options.run(command, args, opts); return command === "osascript" ? windows : ""; },
    syncLabels: async () => { activated.push("metadata"); return { failures: [] }; },
    start: async () => { activated.push("activity"); },
  };
  await assert.rejects(applyCurrentTheme("pink", 14, options), error => error.persisted && error.failed.includes("terminal") && /no open Herdr Ghostty window/.test(error.message));
  assert.deepEqual(activated, ["metadata", "activity"]);
  assert.ok(f.calls.some(call => call.args[1] === "reload-config"));
  assert.equal(JSON.parse(fs.readFileSync(f.markdownPaths.sidebar)).colors, "light");
  assert.match(fs.readFileSync(f.markdownPaths.glow, "utf8"), /light/);
  assert.equal(JSON.parse(fs.readFileSync(join(f.agentDir, "themes/herdr-contrast.json"))).vars.userMsgBg, "#f4a0bf");
  assert.equal(JSON.parse(fs.readFileSync(f.sidebarStatus)).sidebar_background, "#ffebea");
  const saved = new Map([...f.originals.keys()].map(path => [path, fs.readFileSync(path)]));
  windows = "1";
  await applyCurrentTheme("pink", 14, options);
  for (const [path, content] of saved) assert.deepEqual(fs.readFileSync(path), content);
});

test("Windows corrupt Terminal JSON fails during preparation without changing other files", t => {
  const f = fixture(t, "win32");
  fs.writeFileSync(f.terminalPath, "{broken"); f.originals.set(f.terminalPath, "{broken");
  assert.throws(() => applyPalette("pink", 14, f.options), SyntaxError);
  f.unchanged();
});

test("post-commit metadata failure is explicit and does not prevent activity activation", async t => {
  const f = fixture(t);
  let started = false;
  await assert.rejects(applyCurrentTheme("red", 14, { ...f.options,
    syncLabels: async () => ({ failures: ["workspace"] }), start: async () => { started = true; },
  }), error => error.persisted && error.failed.includes("metadata"));
  assert.equal(started, true);
  assert.equal(JSON.parse(fs.readFileSync(f.settingsPath)).theme, "red");
});

test("recovery removes newly created files and retains original file permissions", t => {
  const f = fixture(t);
  const existing = f.settingsPath, missing = join(f.home, "new");
  fs.chmodSync(existing, 0o600);
  const originalMode = fs.statSync(existing).mode & 0o777;
  const changes = [fileChange(missing, "new"), fileChange(existing, "changed")];
  const io = { ...fs, renameSync(from, to) { if (to === existing) throw new Error("denied"); fs.renameSync(from, to); } };
  assert.throws(() => commitFiles(changes, { io }), /denied/);
  assert.equal(fs.existsSync(missing), false);
  assert.equal(fs.statSync(existing).mode & 0o777, originalMode);
});

test("a change derived from one captured source never overwrites a later edit", t => {
  const f = fixture(t);
  const change = fileChange(f.settingsPath, source => source.toString("utf8").replace('"blue"', '"pink"'));
  fs.writeFileSync(f.settingsPath, "external edit");
  assert.throws(() => commitFiles([change]), /File changed/);
  assert.equal(fs.readFileSync(f.settingsPath, "utf8"), "external edit");
});

test("validation-only staging cleanup fails before any durable file change", t => {
  const f = fixture(t);
  const changes = [fileChange(f.configPath, source => source), fileChange(f.settingsPath, "updated")];
  let fail = true;
  const io = { ...fs, unlinkSync(path) { if (fail) { fail = false; throw new Error("cleanup denied"); } fs.unlinkSync(path); } };
  assert.throws(() => commitFiles(changes, { io }), /cleanup denied/);
  f.unchanged();
});
