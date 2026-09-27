import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTheme, herdrConfigPath, reloadLocalConfig } from "./apply.mjs";

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
  assert.match(pink, /sidebar_bg = "#9e125c"/);
  for (const color of ["#ff3030", "#ffff00", "#00ff66", "#ff9a64", "#6cdaff"]) assert.ok(pink.includes(color));
  assert.match(pink, /\$ultra_provider_1"/);
  assert.match(pink, /\$ultra_provider_26"/);
  assert.equal(applyTheme(pink, "blue"), blue);
  const red = applyTheme(pink, "red");
  assert.match(red, /sidebar_bg = "#26262b"/);
  assert.match(red, /active_row_bg = "#c81d25"/);
  for (const color of ["#ff3030", "#ffff00", "#00ff66", "#ff9a64", "#6cdaff"]) assert.ok(red.includes(color));
  assert.equal(applyTheme(red, "red"), red);
  assert.equal(applyTheme(red, "pink"), pink);
  assert.equal(applyTheme(red, "blue"), blue);
  assert.throws(() => applyTheme(blue, "invalid"), /Theme/);
});
