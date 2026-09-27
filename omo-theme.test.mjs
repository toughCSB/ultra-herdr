import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { omoTheme, syncOmoTheme } from "./omo-theme.mjs";

test("Pink changes message and tool surfaces but keeps status and diff semantics", () => {
  const blue = omoTheme("blue");
  const pink = omoTheme("pink");
  for (const key of ["userMsgBg", "toolPendingBg", "toolSuccessBg", "customMsgBg", "cyan", "blue"]) {
    assert.notEqual(pink.vars[key], blue.vars[key]);
  }
  for (const key of ["success", "error", "warning", "toolDiffAdded", "toolDiffRemoved"]) {
    assert.equal(pink.colors[key], blue.colors[key]);
  }
  assert.equal(pink.export.cardBg, pink.vars.toolPendingBg);
  assert.deepEqual(omoTheme("blue"), blue);
});

test("RED main-pane surfaces use the reference without recoloring semantic signals", () => {
  const blue = omoTheme("blue");
  const red = omoTheme("red");
  assert.equal(red.vars.userMsgBg, "#fff0f3");
  assert.equal(red.colors.userMessageText, "#c81d25");
  assert.equal(red.vars.toolSuccessBg, "#26262b");
  assert.equal(red.vars.accent, "#ff595e");
  assert.equal(red.export.pageBg, "#0b0b0e");
  for (const key of ["green", "red", "yellow"]) assert.equal(red.vars[key], blue.vars[key]);
  for (const key of ["success", "error", "warning", "toolDiffAdded", "toolDiffRemoved"]) {
    assert.equal(red.colors[key], blue.colors[key]);
  }
});

test("selected custom theme reloads in place without changing model or other settings", () => {
  const directory = mkdtempSync(join(tmpdir(), "ultra-omo-"));
  try {
    mkdirSync(join(directory, "themes"));
    const settings = { theme: "herdr-contrast", defaultModel: "keep-model", other: true };
    writeFileSync(join(directory, "settings.json"), JSON.stringify(settings));
    assert.deepEqual(syncOmoTheme("pink", directory), { applied: true, theme: "herdr-contrast", changedSelection: false });
    assert.deepEqual(JSON.parse(readFileSync(join(directory, "settings.json"), "utf8")), settings);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, "themes/herdr-contrast.json"), "utf8")), omoTheme("pink"));
    syncOmoTheme("red", directory);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, "themes/herdr-contrast.json"), "utf8")), omoTheme("red"));
    syncOmoTheme("blue", directory);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, "themes/herdr-contrast.json"), "utf8")), omoTheme("blue"));
    assert.throws(() => syncOmoTheme("invalid", directory), /Theme/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
