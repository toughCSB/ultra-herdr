import { createInterface } from "node:readline/promises";
import { hostname } from "node:os";
import { getFontSize, getThemeName, getLocalMachineLabel, validateFontSize } from "./font.mjs";
import { getTheme } from "./themes.mjs";
import { applyCurrentTheme, applyPalette } from "./apply.mjs";

const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log("\n  ultra-herdr - local Herdr plugin settings\n");
  console.log(`  This PC: ${getLocalMachineLabel()} (${hostname()})`);
  console.log("  Only this PC is changed. No remote synchronization.\n");
  const preset = process.env.ULTRA_HERDR_THEME;
  if (preset) {
    getTheme(preset);
    applyPalette(preset);
    console.log(`  Applied locally: ${preset}. Font unchanged.`);
  } else {
    const themeInput = (await input.question(`  Theme blue/pink/red [${getThemeName()}]: `)).trim();
    if (themeInput !== "q") {
      const sizeInput = (await input.question(`  Font size [${getFontSize()}]: `)).trim();
      if (sizeInput !== "q") {
        const name = themeInput || getThemeName();
        const size = sizeInput === "" ? getFontSize() : Number(sizeInput);
        getTheme(name);
        validateFontSize(size);
        await applyCurrentTheme(name, size);
        console.log(`\n  Applied locally: ${name}, ${size} pt`);
      }
    }
  }
  console.log("  If a remote view keeps old chrome: Herdr menu > reload config.");
} catch (error) {
  console.error(`\n  ${error.message}`);
  if (process.stdin.isTTY) await input.question("\n  Press Enter to close.");
  process.exitCode = 1;
} finally {
  input.close();
}
