import { createInterface } from "node:readline/promises";
import { hostname } from "node:os";
import { getFontSize, getThemeName, getLocalMachineLabel, validateFontSize } from "./font.mjs";
import { getTheme } from "./themes.mjs";
import { applyCurrentTheme } from "./apply.mjs";

const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log("\n  ultra-herdr - local Herdr plugin settings\n");
  console.log(`  설정 대상 PC: ${getLocalMachineLabel()} (${hostname()})`);
  console.log("  이 프로그램이 실행되는 PC만 변경합니다.");
  console.log("  원격 세션 메뉴에서는 원격 PC 설정이 열립니다.");
  console.log("  보는 PC 설정: Local 선택 또는 로컬 설정 바로가기\n");
  const preset = process.env.ULTRA_HERDR_THEME;
  if (preset) {
    getTheme(preset);
    await applyCurrentTheme(preset);
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
