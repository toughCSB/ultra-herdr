import assert from "node:assert/strict";
import { test } from "node:test";
import { getTheme } from "./themes.mjs";

test("blue remains the current Herdr palette and sidebar row colors", () => {
  assert.deepEqual(getTheme().colors, {
    panel_bg: "#000000", sidebar_bg: "#1d4263", surface_dim: "#ffffff",
    overlay0: "#a7dff9", overlay1: "#ddf4ff", subtext0: "#d3ecfb",
    accent: "#7fd3ff", active_row_bg: "#3977aa", selection_bg: "#4a85b5",
    text: "#ffffff", red: "#ff3030", yellow: "#ffff00",
    green: "#00ff66", teal: "#00ff66",
  });
  assert.deepEqual(
    { badge: getTheme().badge, title: getTheme().title, separator: getTheme().separator },
    { badge: "#7fdfff", title: "#d3ecfb", separator: "#6f97b8" },
  );
  assert.equal(getTheme("blue"), getTheme());
});

test("pink uses light surfaces and dark semantic status colors", () => {
  const { colors: blue, ...blueRows } = getTheme("blue");
  const { colors: pink, ...pinkRows } = getTheme("pink");
  assert.equal(pink.sidebar_bg, "#ffebea");
  assert.equal(pink.active_row_bg, "#febab9");
  assert.equal(pinkRows.sidebarText, "#480d30");
  assert.equal(pinkRows.workingColor, "#d65a00");
  assert.equal(pinkRows.providerDefault, "#16161c");
  assert.deepEqual(pinkRows.providerColors, {
    claude: "#d97757", codex: "#16161c", opencode: "#16161c", cline: "#586876",
    kimi: "#1783ff", kilo: "#9a9808", deepseek: "#4d6bfe", gemini: "#4285f4",
    qwen: "#615ced", kiro: "#9046ff",
  });
  assert.equal(pink.selection_bg, "#9b235f");
  assert.notEqual(pink.selection_bg, pink.active_row_bg);
  assert.deepEqual(Object.keys(pink), Object.keys(blue));
  assert.deepEqual(
    Object.fromEntries(["panel_bg", "surface_dim", "text", "red", "yellow", "green", "teal"]
      .map((key) => [key, pink[key]])),
    {
      panel_bg: "#fffafa", surface_dim: "#30252b", text: "#30252b",
      red: "#ff3030", yellow: "#d65a00", green: "#168a45", teal: "#168a45",
    },
  );
  for (const key of ["workingColor", "badge", "title", "separator"]) {
    assert.notEqual(pinkRows[key], blueRows[key]);
  }
});

test("Pink terminal palette has readable colors against its light surface", () => {
  const pink = getTheme("pink");
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  assert.equal(pink.terminalPalette?.length, 9);
  for (const color of pink.terminalPalette) {
    assert.ok((luminance(pink.colors.panel_bg) + 0.05) / (luminance(color) + 0.05) >= 4.5, color);
  }
  assert.ok((luminance("#ffffff") + 0.05) / (luminance(pink.colors.selection_bg) + 0.05) >= 7);
  assert.equal(getTheme("red").terminalPalette, undefined);
  assert.equal(getTheme("blue").terminalPalette, undefined);
});

test("unknown theme names fail rather than selecting an implicit fallback", () => {
  for (const name of ["", "Blue", "other", null, 0]) {
    assert.throws(() => getTheme(name), /blue, pink, or red/);
  }
});

test("RED uses the supplied swatches and keeps lifecycle colors", () => {
  const red = getTheme("red");
  assert.equal(red.colors.panel_bg, "#0b0b0e");
  assert.equal(red.colors.sidebar_bg, "#26262b");
  assert.equal(red.colors.active_row_bg, "#c81d25");
  assert.equal(red.colors.accent, "#ff595e");
  assert.equal(red.colors.text, "#fff0f3");
  for (const key of ["red", "yellow", "green", "teal"]) {
    assert.equal(red.colors[key], getTheme("blue").colors[key]);
  }
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const [foreground, background] of [
    [red.colors.text, red.colors.active_row_bg],
    [red.colors.accent, red.colors.sidebar_bg],
  ]) {
    assert.ok((luminance(foreground) + 0.05) / (luminance(background) + 0.05) >= 4.5);
  }
});
