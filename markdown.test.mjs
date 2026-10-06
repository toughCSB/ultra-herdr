import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markdownPaths, sidebarMarkdownTheme, glowMarkdownTheme, syncMarkdownViewers } from "./markdown.mjs";

test("sidebar Markdown follows execution-PC brightness and preserves explorer options", () => {
  const original = { colors: "light", follow_cwd: false, sidebar_width: 32, preview_placement: "tab", icons: "emoji", future: [1, 2] };
  for (const name of ["red", "blue", "pink", "red"]) {
    const updated = sidebarMarkdownTheme(JSON.stringify(original), name);
    assert.deepEqual(JSON.parse(updated), { ...original, colors: name === "pink" ? "light" : "vscode" });
    assert.equal(sidebarMarkdownTheme(updated, name), updated);
  }
  assert.throws(() => sidebarMarkdownTheme("{", "blue"));
  assert.throws(() => sidebarMarkdownTheme("[]", "blue"));
});

test("standalone Glow matches the sidebar without changing unrelated YAML settings", () => {
  const source = '# reader\nstyle: "light" # previous\nmouse: true\nwidth: 100\npager: false\n';
  const dark = glowMarkdownTheme(source, "red");
  assert.equal(dark, '# reader\nstyle: "dark"\nmouse: true\nwidth: 100\npager: false\n');
  assert.equal(glowMarkdownTheme(dark, "blue"), dark);
  assert.equal(glowMarkdownTheme("mouse: true", "pink"), 'mouse: true\nstyle: "light"\n');
});

test("reader settings use their own native state root, not the ultra-herdr plugin state", () => {
  assert.deepEqual(markdownPaths("darwin", { HERDR_PLUGIN_STATE_DIR: "/wrong" }, "/Users/test"), {
    sidebar: "/Users/test/.local/state/herdr/plugins/herdr-sidebar/state.json",
    glow: "/Users/test/Library/Preferences/glow/glow.yml",
  });
  assert.equal(markdownPaths("win32", { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }).sidebar,
    "C:\\Users\\test\\AppData\\Local\\herdr\\plugins\\herdr-sidebar\\state.json");
});

test("theme application updates existing viewer files and leaves absent plugins alone", () => {
  const base = mkdtempSync(join(tmpdir(), "ultra-markdown-"));
  try {
    const paths = { sidebar: join(base, "state.json"), glow: join(base, "glow.yml") };
    assert.equal(syncMarkdownViewers("red", { paths }), 0);
    writeFileSync(paths.sidebar, '{"colors":"light","preview_placement":"tab"}');
    writeFileSync(paths.glow, 'style: "light"\nwidth: 100\n');
    assert.equal(syncMarkdownViewers("red", { paths }), 2);
    assert.equal(syncMarkdownViewers("red", { paths }), 0);
    assert.equal(JSON.parse(readFileSync(paths.sidebar)).preview_placement, "tab");
    assert.equal(syncMarkdownViewers("pink", { paths }), 2);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
