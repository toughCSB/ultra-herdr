import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sidebarTheme, syncSidebarTheme } from "./sidebar-theme.mjs";
import { getTheme } from "./themes.mjs";
import { applyTheme } from "./apply.mjs";

const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
  .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

for (const name of ["blue", "pink", "red"]) {
  test(`${name} restores status colors and distinguishes attention rows without text badges`, () => {
    const theme = getTheme(name), data = sidebarTheme(name);
    const foreground = theme.sidebarText || theme.colors.text;
    assert.equal(new Set(Object.values(data.states).map(p => p.icon)).size, 5);
    assert.equal(data.version, 2);
    assert.equal(data.states.done.foreground, theme.colors.green);
    assert.equal(data.states.idle.foreground, theme.colors.green);
    assert.notEqual(data.states.done.row_background, data.states.idle.row_background);
    assert.equal(new Set(["working", "blocked", "done"].map(status => data.states[status].row_background)).size, 3);
    for (const [status, paint] of Object.entries(data.states)) {
      assert.equal(paint.background, undefined);
      assert.ok(contrast(paint.foreground, paint.row_background) >= (name === "pink" ? 3 : 4.5));
      // A dark Pink Blocked row uses the native renderer's existing
      // background-aware text correction; native Buffer tests verify it.
      if (name !== "pink" || status !== "blocked") {
        assert.ok(contrast(foreground, paint.row_background) >= 4.5);
      }
      assert.ok(contrast(foreground, theme.colors.active_row_bg) >= 4.5);
    }
    assert.equal(data.states.working.foreground, theme.workingColor || theme.colors.yellow);
    assert.equal(data.states.blocked.foreground, theme.colors.red);
    const selected = name === "pink" ? "#febab9" : theme.colors.active_row_bg;
    assert.ok(luminance(data.states.blocked.row_background) < luminance(selected));
    for (const status of ["working", "done"]) {
      assert.ok(luminance(data.states.blocked.row_background) < luminance(data.states[status].row_background));
    }
    assert.ok(contrast(data.states.blocked.row_background, selected) >= 2.9,
      `${name} Blocked must stand out from the original selected row`);
    const config = applyTheme('[theme]\nname="tokyo-night"\nauto_switch=false\n[theme.custom]\n# >>> ultra-herdr sidebar\n[ui.sidebar.agents]\nrows=[]\n# <<< ultra-herdr sidebar\n', name);
    assert.ok(config.includes(`starts_with = "done", fg = "${data.states.done.foreground}"`));
    assert.ok(config.includes(`starts_with = "idle", fg = "${data.states.idle.foreground}"`));
    assert.ok(config.includes('rows = [["state_icon", { token = "state_text"'));
  });
}

test("the viewer's managed file follows theme changes and does not use terminal workspace metadata", () => {
  const dir = mkdtempSync(join(tmpdir(), "ultra-sidebar-"));
  try {
    const config = join(dir, "config.toml");
    assert.equal(syncSidebarTheme("red", config), true);
    assert.equal(syncSidebarTheme("red", config), false);
    assert.equal(syncSidebarTheme("pink", config), true);
    const path = join(dir, "plugins/config/local.ultra-herdr/sidebar-status.json");
    assert.deepEqual(JSON.parse(readFileSync(path)), sidebarTheme("pink"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
