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
  test(`${name} statuses remain distinct and readable on ordinary and selected rows`, () => {
    const theme = getTheme(name), data = sidebarTheme(name);
    const foreground = theme.sidebarText || theme.colors.text;
    assert.equal(new Set(Object.values(data.states).map(p => p.icon)).size, 5);
    assert.notEqual(data.states.done.foreground, data.states.idle.foreground);
    for (const paint of Object.values(data.states)) {
      assert.ok(contrast(paint.foreground, paint.background) >= 4.5);
      assert.ok(contrast(foreground, paint.row_background) >= 4.5);
      assert.ok(contrast(foreground, theme.colors.active_row_bg) >= 4.5);
    }
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
