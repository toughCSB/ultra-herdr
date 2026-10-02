import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fontConfig, fontSettings, localMachineLabel, terminalFontConfig, terminalSettingsPath, themeSettings, validateFontSize } from "./font.mjs";

test("font size updates retain the machine badge and unrelated plugin settings", () => {
  const settings = { fontSize: 12, localMachineLabel: "SV", other: "keep" };
  const updated = fontSettings(settings, 14);
  assert.deepEqual(updated, { fontSize: 14, localMachineLabel: "SV", other: "keep" });
  assert.equal(localMachineLabel(updated, "host-name"), "SV");
  assert.equal(settings.fontSize, 12);
});

test("self badge defaults to this hostname and accepts independent labels", () => {
  assert.equal(localMachineLabel({}, "home-desktop"), "home-desktop");
  assert.equal(localMachineLabel({}, "work-laptop"), "work-laptop");
  assert.equal(localMachineLabel({ localMachineLabel: "Studio" }, "host-name"), "Studio");
  assert.throws(() => localMachineLabel({ localMachineLabel: "[SV]" }, "host-name"), /localMachineLabel/);
});

test("Windows Terminal creates only the named Herdr profile", () => {
  const settings = `{
    // Preserve this unrelated default and profile.
    "profiles": {"defaults": {"font": {"face": "Jetendard"}},
      "list": [{"name": "Windows PowerShell", "guid": "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}",
        "font": {"face": "Jetendard, Herdr Agent Icons Max", "size": 11},},]},
    "defaultProfile": "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}"
  }`;
  const original = JSON.parse(terminalFontConfig(settings, 14));
  assert.deepEqual(original.profiles.defaults, { font: { face: "Jetendard" } });
  assert.equal(original.profiles.list[0].font.size, 11);
  assert.equal(original.defaultProfile, original.profiles.list[0].guid);
  assert.deepEqual(original.profiles.list[1], {
    name: "Herdr", commandline: "herdr", background: "#000000",
    font: { face: "Jetendard, Herdr Agent Icons Max", size: 14 },
  });
  const updated = JSON.parse(terminalFontConfig(JSON.stringify(original), 16));
  assert.equal(updated.profiles.list.length, 2);
  assert.equal(updated.profiles.list[1].font.size, 16);
  assert.equal(updated.profiles.list[0].font.size, 11);
  assert.equal(terminalFontConfig(JSON.stringify(updated), 16), terminalFontConfig(terminalFontConfig(settings, 16), 16));
  assert.equal(terminalSettingsPath({ LOCALAPPDATA: "C:\\Users\\SV\\AppData\\Local" }),
    "C:\\Users\\SV\\AppData\\Local\\Packages\\Microsoft.WindowsTerminal_8wekyb3d8bbwe\\LocalState\\settings.json");
  assert.throws(() => terminalFontConfig('{"profiles":{}}', 14), /profiles.list/);
});

test("font size replaces only the launcher size and remains idempotent", () => {
  const source = "command = direct:herdr\nfont-size = 13\nbackground = #000000\n";
  const result = fontConfig(source, 14);
  assert.equal(result, "command = direct:herdr\nfont-size = 14\nbackground = #000000\n");
  assert.equal(fontConfig(result, 14), result);
});

test("Windows Pink sets light terminal defaults without changing other profiles", () => {
  const source = JSON.stringify({
    profiles: { list: [
      { name: "PowerShell", background: "#111111" },
      { name: "Herdr", commandline: "custom-herdr.exe", font: { face: "Keep Font", size: 12 } },
    ] },
  });
  const pink = JSON.parse(terminalFontConfig(source, 12, "pink"));
  assert.deepEqual(pink.profiles.list[0], { name: "PowerShell", background: "#111111" });
  assert.deepEqual(pink.profiles.list[1], {
    name: "Herdr", commandline: "custom-herdr.exe", font: { face: "Keep Font", size: 12 },
    background: "#fffafa", foreground: "#30252b", cursorColor: "#30252b",
    selectionBackground: "#febab9",
  });
  const blue = JSON.parse(terminalFontConfig(JSON.stringify(pink), 12, "blue"));
  assert.equal(blue.profiles.list[1].background, "#000000");
  assert.equal(blue.profiles.list[1].foreground, "#d4d4d4");
});

test("font size can be inserted when the launcher used the default", () => {
  assert.equal(fontConfig("font-family = Jetendard\n", 16.5), "font-family = Jetendard\nfont-size = 16.5\n");
});

test("invalid font settings fail before writing config", () => {
  for (const size of [0, 7, 37, NaN, Infinity, "14"]) {
    assert.throws(() => validateFontSize(size), /between 8 and 36/);
  }
});

test("theme update preserves font size, machine label, and unrelated settings", () => {
  const settings = { fontSize: 16, localMachineLabel: "Mac", other: "keep", theme: "blue" };
  assert.deepEqual(themeSettings(settings, "pink"), { ...settings, theme: "pink" });
  assert.deepEqual(themeSettings(settings, "red"), { ...settings, theme: "red" });
  assert.deepEqual(fontSettings(settings, 18), { ...settings, fontSize: 18 });
  assert.equal(settings.theme, "blue");
  assert.throws(() => themeSettings(settings, "purple"), /blue, pink, or red/);
});

test("theme storage defaults to blue and validates before changing settings", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ultra-herdr-theme-"));
  const previous = process.env.HERDR_PLUGIN_CONFIG_DIR;
  try {
    process.env.HERDR_PLUGIN_CONFIG_DIR = directory;
    const { getThemeName, setThemeName } = await import(`./font.mjs?settings-test=${encodeURIComponent(directory)}`);
    const path = join(directory, "settings.json");
    assert.equal(getThemeName(), "blue");
    writeFileSync(path, JSON.stringify({ fontSize: 17, localMachineLabel: "SV", extra: "keep" }));
    assert.equal(getThemeName(), "blue");
    assert.equal(setThemeName("pink"), "pink");
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
      fontSize: 17, localMachineLabel: "SV", extra: "keep", theme: "pink",
    });
    assert.equal(setThemeName("red"), "red");
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
      fontSize: 17, localMachineLabel: "SV", extra: "keep", theme: "red",
    });
    const stored = readFileSync(path, "utf8");
    assert.throws(() => setThemeName("purple"), /blue, pink, or red/);
    assert.equal(readFileSync(path, "utf8"), stored);
    writeFileSync(path, JSON.stringify({ theme: "purple" }));
    assert.throws(() => getThemeName(), /blue, pink, or red/);
  } finally {
    if (previous === undefined) delete process.env.HERDR_PLUGIN_CONFIG_DIR;
    else process.env.HERDR_PLUGIN_CONFIG_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
