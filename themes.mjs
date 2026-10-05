const blue = {
  colors: {
    panel_bg: "#000000",
    sidebar_bg: "#1d4263",
    surface0: "#24283b",
    surface1: "#414868",
    surface_dim: "#ffffff",
    overlay0: "#a7dff9",
    overlay1: "#ddf4ff",
    subtext0: "#d3ecfb",
    accent: "#7fd3ff",
    active_row_bg: "#3977aa",
    selection_bg: "#4a85b5",
    text: "#ffffff",
    red: "#ff3030",
    yellow: "#ffff00",
    green: "#00ff66",
    teal: "#00ff66",
  },
  userMessage: { background: "#a8e1fb", foreground: "#0b2c45" },
  codeBlock: { background: "#123b70", foreground: "#e1efff" },
  badge: "#7fdfff",
  title: "#d3ecfb",
  separator: "#6f97b8",
};

const pink = {
  colors: {
    ...blue.colors,
    panel_bg: "#fffafa",
    sidebar_bg: "#ffebea",
    surface0: "#f5dce8",
    surface1: "#fbe8f1",
    surface_dim: "#30252b",
    overlay0: "#705d67",
    overlay1: "#480d30",
    subtext0: "#60404f",
    accent: "#a32463",
    active_row_bg: "#febab9",
    selection_bg: "#9b235f",
    text: "#30252b",
    yellow: "#d65a00",
    green: "#168a45",
    teal: "#168a45",
  },
  userMessage: { background: "#f4a0bf", foreground: "#480d30" },
  terminalPalette: [
    "#30252b", "#b42318", "#146b3a", "#8a4b00", "#244da8",
    "#74338f", "#006a73", "#68505c", "#9b235f",
  ],
  sidebarText: "#480d30",
  workingColor: "#d65a00",
  providerDefault: "#16161c",
  providerColors: {
    claude: "#d97757",
    codex: "#16161c",
    opencode: "#16161c",
    cline: "#586876",
    kimi: "#1783ff",
    kilo: "#9a9808",
    deepseek: "#4d6bfe",
    gemini: "#4285f4",
    qwen: "#615ced",
    kiro: "#9046ff",
  },
  badge: "#ffd0e9",
  title: "#ffe1f1",
  separator: "#ef87be",
};

const red = {
  colors: {
    ...blue.colors,
    panel_bg: "#0b0b0e",
    sidebar_bg: "#26262b",
    surface_dim: "#fff0f3",
    overlay0: "#ff595e",
    overlay1: "#fff0f3",
    subtext0: "#fff0f3",
    accent: "#ff595e",
    active_row_bg: "#c81d25",
    selection_bg: "#c81d25",
    text: "#fff0f3",
  },
  userMessage: { background: "#ffb3b8", foreground: "#650d18" },
  codeBlock: { background: "#e9ddff", foreground: "#302044" },
  badge: "#ff595e",
  title: "#fff0f3",
  separator: "#ff595e",
};

export function getTheme(name = "blue") {
  if (name === "blue") return blue;
  if (name === "pink") return pink;
  if (name === "red") return red;
  throw new Error("Theme must be blue, pink, or red");
}
