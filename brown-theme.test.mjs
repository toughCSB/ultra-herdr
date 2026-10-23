import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getTheme } from "./themes.mjs";
import { applyTheme } from "./apply.mjs";
import { sidebarTheme } from "./sidebar-theme.mjs";
import { omoTheme } from "./omo-theme.mjs";
import { terminalFontConfig, themeSettings } from "./font.mjs";
import { sidebarMarkdownTheme, glowMarkdownTheme } from "./markdown.mjs";
import { syncLabels } from "./labels.mjs";

const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
  .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test("Dark Brown maps the five reference swatches and preserves Blue's semantic indicators", () => {
  const brown = getTheme("brown"), blue = getTheme("blue");
  assert.deepEqual([brown.colors.panel_bg, brown.colors.sidebar_bg, brown.colors.active_row_bg,
    brown.colors.accent, brown.colors.text], ["#2e1c12", "#5b3a2a", "#9a6b4a", "#d9b38c", "#fff1e3"]);
  assert.deepEqual(Object.keys(brown.colors), Object.keys(blue.colors));
  for (const key of ["red", "yellow", "green", "teal"]) assert.equal(brown.colors[key], blue.colors[key]);
  const states = sidebarTheme("brown").states;
  for (const [status, paint] of Object.entries(states)) {
    assert.equal(paint.icon, blue.sidebarStates[status].icon);
    assert.equal(paint.foreground, blue.sidebarStates[status].foreground);
    assert.ok(contrast(paint.foreground, paint.row_background) >= 4.5, status);
    assert.ok(contrast(brown.colors.text, paint.row_background) >= 4.5, status);
  }
  assert.ok(contrast(states.blocked.row_background, brown.colors.active_row_bg) >= 2.9);
  for (const [fg, bg] of [
    [brown.colors.text, brown.colors.panel_bg], [brown.colors.text, brown.colors.surface0],
    [brown.colors.text, brown.colors.surface1], [brown.colors.overlay0, brown.colors.surface1],
    [brown.userMessage.foreground, brown.userMessage.background],
    [brown.codeBlock.foreground, brown.codeBlock.background],
    ...brown.terminalPalette.map(fg => [fg, brown.colors.panel_bg]),
  ]) assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}`);
});

test("switching to and from Brown restores all previous themes and keeps prefix/font/layout", () => {
  const seed = readFileSync(new URL("./examples/herdr-config.example.toml", import.meta.url), "utf8")
    + '\n[keys]\nprefix = "cmd+b"\n';
  const brown = applyTheme(seed, "brown");
  assert.match(brown, /prefix = "cmd\+b"/);
  assert.equal(applyTheme(brown, "brown"), brown);
  for (const name of ["blue", "pink", "red"]) {
    assert.equal(applyTheme(brown, name), applyTheme(seed, name));
    assert.equal(applyTheme(applyTheme(seed, name), "brown"), brown);
  }
  assert.deepEqual(themeSettings({ fontSize: 14, extra: true }, "brown"), { fontSize: 14, extra: true, theme: "brown" });
  const original = { profiles: { list: [{ name: "PowerShell", untouched: true }, {
    name: "Herdr", commandline: "keep.exe", font: { face: "Keep", size: 14 },
  }] } };
  const result = JSON.parse(terminalFontConfig(JSON.stringify(original), 14, "brown"));
  assert.deepEqual(result.profiles.list[0], original.profiles.list[0]);
  assert.equal(result.profiles.list[1].foreground, "#fff1e3");
  assert.equal(result.profiles.list[1].background, "#2e1c12");
  assert.deepEqual(result.profiles.list[1].font, original.profiles.list[1].font);
  assert.equal(result.profiles.list[1].commandline, "keep.exe");
});

test("Brown OMO and Markdown use readable dark surfaces without changing success/error signals", () => {
  const brown = omoTheme("brown"), blue = omoTheme("blue");
  assert.equal(brown.export.pageBg, "#2e1c12");
  for (const key of ["cyan", "blue", "accent"]) assert.equal(brown.vars[key], "#d9b38c");
  for (const key of ["selectedBg", "toolPendingBg", "toolSuccessBg", "toolErrorBg", "customMsgBg"]) {
    assert.ok(contrast(brown.vars.text, brown.vars[key]) >= 4.5, key);
  }
  for (const key of ["green", "red", "yellow"]) assert.equal(brown.vars[key], blue.vars[key]);
  for (const key of ["success", "error", "warning", "toolDiffAdded", "toolDiffRemoved"]) assert.equal(brown.colors[key], blue.colors[key]);
  assert.equal(JSON.parse(sidebarMarkdownTheme('{"colors":"light","other":true}', "brown")).colors, "vscode");
  assert.equal(glowMarkdownTheme('style: "light"\n', "brown"), 'style: "dark"\n');
});

test("Brown publishes the execution-PC terminal, chat and code colors and exposes a plugin action", async () => {
  const writes = [];
  await syncLabels({ themeName: "brown", localMachineLabel: "Mac", run: async args => {
    if (args[0] === "api") return JSON.stringify({ result: { snapshot: { panes: [], agents: [], workspaces: [{ workspace_id: "w1", tokens: {} }] } } });
    writes.push(args); return "";
  } });
  const published = writes.flat().join(" ");
  for (const token of ["ultra_terminal_fg=#fff1e3", "ultra_terminal_bg=#2e1c12", "ultra_user_message_bg=#d9b38c",
    "ultra_user_message_fg=#2e1c12", "ultra_code_block_bg=#5b3a2a", "ultra_code_block_fg=#fff1e3"]) assert.ok(published.includes(token), token);
  const manifest = readFileSync(new URL("./herdr-plugin.toml", import.meta.url), "utf8");
  assert.match(manifest, /id = "brown"[\s\S]*?ULTRA_HERDR_THEME=brown/);
});
