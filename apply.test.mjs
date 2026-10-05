import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { applyTheme, herdrConfigPath, reloadLocalConfig, shouldSyncOmoTheme } from "./apply.mjs";
import { getTheme } from "./themes.mjs";
import { terminalSettingsPath } from "./font.mjs";

test("Pink control surfaces persist and restore when switching back to Blue or RED", () => {
  const seed = '[theme]\nname="tokyo-night"\nauto_switch=false\n[theme.custom]\n';
  const pink = applyTheme(seed, "pink");
  assert.match(pink, /surface0 = "#f5dce8"/);
  assert.match(pink, /surface1 = "#fbe8f1"/);
  for (const name of ["blue", "red"]) {
    const restored = applyTheme(pink, name);
    assert.match(restored, /surface0 = "#24283b"/);
    assert.match(restored, /surface1 = "#414868"/);
    assert.equal(restored, applyTheme(seed, name));
    assert.equal(applyTheme(restored, "pink"), pink);
  }
});

test("palette-only Windows preset updates the terminal background while preserving font and command", () => {
  const directory = mkdtempSync(join(tmpdir(), "ultra-herdr-preset-"));
  try {
    const configPath = join(directory, "herdr.toml");
    const pluginConfig = join(directory, "plugin");
    mkdirSync(pluginConfig);
    writeFileSync(configPath, '[theme]\nname="tokyo-night"\nauto_switch=false\n[theme.custom]\n');
    writeFileSync(join(pluginConfig, "settings.json"), JSON.stringify({
      fontSize: 10, localMachineLabel: "SV", theme: "blue",
    }));
    const terminalPath = join(directory, terminalSettingsPath({ LOCALAPPDATA: "local" }));
    mkdirSync(dirname(terminalPath), { recursive: true });
    writeFileSync(terminalPath, JSON.stringify({ profiles: { list: [{
      name: "Herdr", commandline: "keep-herdr.exe", background: "#000000",
      font: { face: "Keep Font", size: 10 },
    }] } }));
    const source = new URL("./apply.mjs", import.meta.url).href;
    execFileSync(process.execPath, ["--input-type=module", "-e", `
      import childProcess from "node:child_process";
      import os from "node:os";
      import { syncBuiltinESMExports } from "node:module";
      childProcess.execFileSync = () => "";
      os.homedir = () => process.env.HOME;
      syncBuiltinESMExports();
      Object.defineProperty(process, "platform", { value: "win32" });
      const { applyPalette } = await import(${JSON.stringify(source)});
      applyPalette("pink");
    `], {
      cwd: directory, timeout: 5000,
      env: {
        ...process.env, HOME: directory, APPDATA: "roaming", LOCALAPPDATA: "local",
        HERDR_CONFIG_PATH: configPath, HERDR_PLUGIN_CONFIG_DIR: pluginConfig,
      },
    });
    const profile = JSON.parse(readFileSync(terminalPath, "utf8")).profiles.list[0];
    assert.equal(profile.background, "#fffafa");
    assert.equal(profile.foreground, "#30252b");
    assert.deepEqual(profile.font, { face: "Keep Font", size: 10 });
    assert.equal(profile.commandline, "keep-herdr.exe");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("theme reload addresses only the local Herdr server", () => {
  const calls = [];
  reloadLocalConfig((args) => {
    calls.push(args);
    return "{}";
  });
  assert.deepEqual(calls, [["server", "reload-config"]]);
});

test("Windows uses APPDATA for Herdr config and Mac retains XDG", () => {
  assert.equal(herdrConfigPath("win32", {
    APPDATA: "C:\\Users\\SV\\AppData\\Roaming", XDG_CONFIG_HOME: "/not/windows",
  }), "C:\\Users\\SV\\AppData\\Roaming\\herdr\\config.toml");
  assert.equal(herdrConfigPath("darwin", { XDG_CONFIG_HOME: "/config" }), "/config/herdr/config.toml");
  assert.throws(() => herdrConfigPath("win32", {}), /APPDATA/);
  assert.equal(herdrConfigPath("win32", { HERDR_CONFIG_PATH: "C:\\custom\\herdr.toml" }), "C:\\custom\\herdr.toml");
});

test("all presets synchronize the OMO main-pane palette", () => {
  assert.equal(shouldSyncOmoTheme("pink"), true);
  assert.equal(shouldSyncOmoTheme("blue"), true);
  assert.equal(shouldSyncOmoTheme("red"), true);
});

test("Pink installs a complete light palette independent of the previous theme", () => {
  const config = [
    "[theme]",
    'name = "dracula"',
    "auto_switch = true",
    "# >>> skyline-blue theme",
    "[theme.custom]",
    'panel_bg = "#101112"',
    'sidebar_bg = "#202122"',
    'surface_dim = "#303132"',
    'overlay0 = "#404142"',
    'overlay1 = "#505152"',
    'subtext0 = "#606162"',
    'accent = "#707172"',
    'active_row_bg = "#808182"',
    'selection_bg = "#909192"',
    'text = "#a0a1a2"',
    'red = "#b0b1b2"',
    'yellow = "#c0c1c2"',
    'green = "#d0d1d2"',
    'teal = "#e0e1e2"',
    "# <<< skyline-blue theme",
    "# >>> ultra-herdr sidebar",
    "[ui.sidebar.agents]",
    "rows = []",
    "# <<< ultra-herdr sidebar",
    "",
  ].join("\n");

  const result = applyTheme(config, "pink");

  assert.match(result, /name = "tokyo-night"/);
  assert.match(result, /auto_switch = false/);
  assert.match(result, /sidebar_bg = "#ffebea"/);
  for (const [key, color] of Object.entries(getTheme("pink").colors)) {
    assert.ok(result.includes(`${key} = "${color}"`), `missing Pink field: ${key}`);
  }
  assert.equal(applyTheme(result, "pink"), result);
});

test("Pink applies the same palette from Windows and Mac line endings", () => {
  const config = [
    "[theme]\r\n",
    'name = "dracula"\n',
    "auto_switch = true\r\n",
    "# >>> skyline-blue theme\n",
    "[theme.custom]\r\n",
    'sidebar_bg = "#202122"\n',
    'active_row_bg = "#808182"\r\n',
    "# <<< skyline-blue theme\n",
    "# >>> ultra-herdr sidebar\r\n",
    "[ui.sidebar.agents]\n",
    "rows = []\r\n",
    "# <<< ultra-herdr sidebar\n",
  ].join("");
  const result = applyTheme(config, "pink");
  assert.equal(result, applyTheme(config.replace(/\r\n/g, "\n"), "pink"));
  assert.equal(applyTheme(result, "pink"), result);
});

test("Skyline Blue restores its palette without changing unrelated settings", () => {
  const config = [
    "onboarding = false",
    "[theme]",
    'name = "dracula"',
    "auto_switch = true",
    "# >>> herdr-radar theme block",
    "[theme.custom]",
    'active_row_bg = "#123456"',
    "# <<< herdr-radar theme block",
    "[ui.sidebar.agents]",
    "rows = []",
    "",
  ].join("\n");
  const result = applyTheme(config);
  assert.match(result, /name = "tokyo-night"/);
  assert.match(result, /sidebar_bg = "#1d4263"/);
  assert.match(result, /surface_dim = "#ffffff"/);
  assert.ok(result.indexOf('sidebar_bg = "#1d4263"') < result.indexOf("# <<< herdr-radar theme block"));
  assert.match(result, /rows = \[\]/);
  assert.equal(applyTheme(result), result);
});

test("Skyline Blue refuses an incompatible config", () => {
  assert.throws(() => applyTheme("[theme]\nname = \"dracula\"\n"), /Missing theme\.auto_switch/);
});

test("Radar vendor overrides cannot hide machine badges or recolor state", () => {
  const config = [
    "[theme]", 'name = "nord"', "auto_switch = false",
    "[theme.custom]", 'red = "#123456"',
    "# >>> herdr-radar sidebar block",
    "[ui.sidebar.agents]", 'rows = [["$title_working"]]',
    "[ui.sidebar.agents.rows_by_agent]", 'claude = [["$title_working"]]',
    "[ui.sidebar.spaces]", 'rows = [["$space_working_claude"]]',
    "# <<< herdr-radar sidebar block",
    "[ui.toast]", 'delivery = "herdr"', "",
  ].join("\n");
  const result = applyTheme(config);
  assert.match(result, /token = "\$skyline_group_machine"/);
  assert.match(result, /agent_panel_sort = "spaces"/);
  assert.match(result, /red = "#ff3030"/);
  assert.match(result, /yellow = "#ffff00"/);
  assert.match(result, /green = "#00ff66"/);
  assert.doesNotMatch(result, /rows_by_agent/);
  assert.equal((result.match(/row_gap = 0/g) || []).length, 2);
  assert.match(result, /token = "\$skyline_provider"/);
  assert.doesNotMatch(result, /token = "agent"/);
  assert.match(result, /\[ui.toast\]\ndelivery = "herdr"/);
  assert.equal(applyTheme(result), result);
});

test("theme switching recolors UI but preserves vendor and lifecycle colors", () => {
  const original = '[ui]\n[theme]\nname="nord"\nauto_switch=false\n[theme.custom]\n# >>> skyline-blue sidebar\n# <<< skyline-blue sidebar\n';
  const blue = applyTheme(original);
  const pink = applyTheme(blue, "pink");
  assert.match(pink, /sidebar_bg = "#ffebea"/);
  assert.match(pink, /active_row_bg = "#febab9"/);
  assert.match(pink, /selection_bg = "#9b235f"/);
  assert.match(pink, /token = "\$skyline_identity", fg = "#480d30"/);
  assert.match(pink, /equals = "\[SV\]", fg = "#480d30"/);
  assert.match(pink, /token = "terminal_title_stripped", fg = "#480d30"/);
  assert.match(pink, /\$ultra_activity", fg = "#d65a00"/);
  assert.match(pink, /starts_with = "working", fg = "#d65a00"/);
  assert.match(pink, /token = "\$ultra_provider_1", bold = true, fg = "#16161c"/);
  const agentRows = pink.split("[ui.sidebar.agents]")[1].split("[ui.sidebar.spaces]")[0];
  const providerRow = agentRows.split("\n").find(line => line.includes("$skyline_branch"));
  assert.ok(providerRow.indexOf('"state_icon"') < providerRow.indexOf('token = "state_text"'));
  assert.ok(providerRow.indexOf('token = "state_text"') < providerRow.indexOf('token = "$skyline_provider"'));
  assert.match(providerRow, /starts_with = "working", fg = "#d65a00"/);
  assert.match(pink, /"state_icon"/);
  for (const color of [
    "#ff3030", "#d65a00", "#168a45", "#16161c", "#d97757", "#586876",
    "#1783ff", "#9a9808", "#4d6bfe", "#4285f4", "#615ced", "#9046ff",
  ]) assert.ok(pink.includes(color));
  assert.match(pink, /\$ultra_provider_1"/);
  assert.match(pink, /\$ultra_provider_26"/);
  assert.equal(applyTheme(pink, "blue"), blue);
  const red = applyTheme(pink, "red");
  assert.match(red, /sidebar_bg = "#26262b"/);
  assert.match(red, /active_row_bg = "#c81d25"/);
  for (const color of ["#ff3030", "#ffff00", "#00ff66", "#ff9a64", "#6cdaff"]) assert.ok(red.includes(color));
  assert.equal(applyTheme(red, "red"), red);
  const pinkFromRed = applyTheme(red, "pink");
  assert.match(pinkFromRed, /sidebar_bg = "#ffebea"/);
  assert.match(pinkFromRed, /panel_bg = "#fffafa"/);
  assert.match(pinkFromRed, /accent = "#a32463"/);
  assert.match(pinkFromRed, /active_row_bg = "#febab9"/);
  assert.equal(applyTheme(pinkFromRed, "blue"), blue);
  assert.throws(() => applyTheme(blue, "invalid"), /Theme/);
});

test("agent identity remains in the first row and theme changes preserve Priority", () => {
  const original = '[ui]\nagent_panel_sort = "priority"\n[theme]\nname="nord"\nauto_switch=false\n[theme.custom]\n# >>> ultra-herdr sidebar\n# <<< ultra-herdr sidebar\n';
  const result = applyTheme(original);
  assert.match(result, /agent_panel_sort = "priority"/);
  const agents = result.split("[ui.sidebar.agents]")[1].split("[ui.sidebar.spaces]")[0];
  assert.match(agents.split("rows = [\n")[1].split("\n")[0], /token = "\$skyline_identity"/);
  assert.match(agents.split("rows = [\n")[1].split("\n")[0], /token = "\$ultra_activity"/);
  assert.match(agents, /"state_icon"/);
});

test("machines show session counts without the redundant state-text row", () => {
  const original = '[theme]\nname="nord"\nauto_switch=false\n[theme.custom]\n# >>> ultra-herdr sidebar\n# <<< ultra-herdr sidebar\n';
  const spaces = applyTheme(original).split("[ui.sidebar.spaces]")[1];
  assert.match(spaces, /\$ultra_session_count/);
  assert.match(spaces, /\$ultra_activity/);
  assert.match(spaces, /"state_icon"/);
  assert.match(spaces, /"branch", "git_status", \{ token = "\$skyline_separator"/);
  assert.match(spaces, /\$skyline_separator/);
  assert.doesNotMatch(spaces, /"state_text"/);
});
