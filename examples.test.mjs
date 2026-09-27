import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyTheme } from "./apply.mjs";
import { validateFontSize, localMachineLabel } from "./font.mjs";

test("published configuration seed expands all themes with managed sidebar rows", () => {
  const seed = readFileSync(new URL("./examples/herdr-config.example.toml", import.meta.url), "utf8");
  for (const theme of ["blue", "pink", "red"]) {
    const config = applyTheme(seed, theme);
    assert.match(config, /\$skyline_group_machine/);
    assert.match(config, /\$ultra_provider_26/);
    assert.equal(applyTheme(config, theme), config);
  }
});

test("local example requires no routing identity and preserves the 14pt default", () => {
  const settings = JSON.parse(readFileSync(new URL("./examples/settings.local.example.json", import.meta.url), "utf8"));
  assert.equal(localMachineLabel(settings), "MyPC");
  assert.equal(validateFontSize(settings.fontSize), 14);
  assert.equal(settings.theme, "blue");
});
