const darkStates = {
  idle: { icon: "●", foreground: "#00ff66" },
  working: { icon: "▶", foreground: "#ffff00", row_background: "#665014" },
  blocked: { icon: "▲", foreground: "#ff3030", row_background: "#420006" },
  done: { icon: "✔", foreground: "#00ff66", row_background: "#126042" },
  unknown: { icon: "◆", foreground: "#b8cce0" },
};

const blue = {
  appearance: "dark",
  terminalForeground: "#d4d4d4",
  sidebarStates: {
    ...darkStates,
    blocked: { ...darkStates.blocked, row_background: "#08134f" },
  },
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
  terminalPalette: [
    "#d4d4d4", "#ff9595", "#91d99b", "#f0d070", "#91caff",
    "#c6a7f6", "#80dce8", "#b8cce0", "#f4a0bf",
  ],
  badge: "#7fdfff",
  title: "#d3ecfb",
  separator: "#6f97b8",
};

const pink = {
  appearance: "light",
  terminalForeground: "#30252b",
  omo: {
    vars: {
      cyan: "#9b235f", blue: "#a32463", accent: "#a32463",
      green: "#9b235f", red: "#b42318", yellow: "#d65a00",
      text: "#30252b", gray: "#705d67", dimGray: "#806b76", darkGray: "#9e8793",
      selectedBg: "#febab9",
      toolPendingBg: "#ffedf3", toolSuccessBg: "#f7e9f0",
      toolErrorBg: "#ffe6e6", customMsgBg: "#fbd8e7",
    },
    colors: {
      customMessageLabel: "#9b235f",
      toolOutput: "#60404f", mdHeading: "#8b2755", mdLink: "#9b235f",
      syntaxKeyword: "#9b235f", syntaxVariable: "#60404f",
      syntaxFunction: "#7b4a00", syntaxString: "#8c3d29", syntaxNumber: "#9b235f",
      syntaxComment: "#9e587b", toolDiffAdded: "#168a45",
      syntaxType: "#7b2d77", syntaxOperator: "#30252b", syntaxPunctuation: "#30252b",
      thinkingLow: "#806b76", thinkingMedium: "#9b235f",
    },
    export: { pageBg: "#fffafa" },
  },
  sidebarStates: {
    idle: { icon: "●", foreground: "#168a45" },
    working: { icon: "▶", foreground: "#d65a00", row_background: "#fff3c2" },
    blocked: { icon: "▲", foreground: "#ff3030", row_background: "#69002f" },
    done: { icon: "✔", foreground: "#168a45", row_background: "#d4f5de" },
    unknown: { icon: "◆", foreground: "#705d67" },
  },
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
  appearance: "dark",
  terminalForeground: "#d4d4d4",
  omo: {
    vars: {
      cyan: "#ff595e", blue: "#ff595e", accent: "#ff595e", text: "#fff0f3",
      selectedBg: "#c81d25",
      toolPendingBg: "#26262b", toolSuccessBg: "#26262b",
      toolErrorBg: "#331015", customMsgBg: "#26262b",
    },
    colors: {
      customMessageLabel: "#ff595e",
      toolOutput: "#fff0f3", mdLink: "#ff595e",
      syntaxKeyword: "#ff595e", syntaxVariable: "#fff0f3",
      syntaxType: "#ff595e", thinkingLow: "#ff595e", thinkingMedium: "#fff0f3",
    },
    export: { pageBg: "#0b0b0e" },
  },
  sidebarStates: darkStates,
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
  terminalPalette: [
    "#fff0f3", "#ff9595", "#91d99b", "#f0d070", "#91caff",
    "#c6a7f6", "#80dce8", "#d4bfc8", "#ffb3b8",
  ],
  badge: "#ff595e",
  title: "#fff0f3",
  separator: "#ff595e",
};

// Caramel Latte: retain Blue's roles/layout and semantic status colors.
const brown = {
  ...blue,
  appearance: "dark",
  omo: {
    vars: {
      cyan: "#d9b38c", blue: "#d9b38c", accent: "#d9b38c", text: "#fff1e3",
      gray: "#d9b38c", dimGray: "#d9b38c", darkGray: "#9a6b4a",
      selectedBg: "#5b3a2a",
      toolPendingBg: "#5b3a2a", toolSuccessBg: "#5b3a2a",
      toolErrorBg: "#4b261e", customMsgBg: "#5b3a2a",
    },
    colors: {
      customMessageLabel: "#d9b38c", toolOutput: "#fff1e3",
      mdHeading: "#fff1e3", mdLink: "#d9b38c",
      syntaxKeyword: "#d9b38c", syntaxVariable: "#fff1e3", syntaxType: "#d9b38c",
      thinkingLow: "#d9b38c", thinkingMedium: "#fff1e3",
    },
    export: { pageBg: "#2e1c12" },
  },
  sidebarStates: {
    ...darkStates,
    blocked: { ...darkStates.blocked, row_background: "#1e1009" },
  },
  colors: {
    ...blue.colors,
    panel_bg: "#2e1c12",
    sidebar_bg: "#5b3a2a",
    surface0: "#2e1c12",
    surface1: "#5b3a2a",
    surface_dim: "#fff1e3",
    overlay0: "#d9b38c",
    overlay1: "#fff1e3",
    subtext0: "#fff1e3",
    accent: "#d9b38c",
    active_row_bg: "#9a6b4a",
    selection_bg: "#9a6b4a",
    text: "#fff1e3",
  },
  userMessage: { background: "#d9b38c", foreground: "#2e1c12" },
  codeBlock: { background: "#5b3a2a", foreground: "#fff1e3" },
  terminalForeground: "#fff1e3",
  sidebarText: "#fff1e3",
  terminalPalette: [
    "#fff1e3", "#ff9595", "#91d99b", "#f0d070", "#d9b38c",
    "#c6a7f6", "#fff1e3", "#d9b38c", "#d9b38c",
  ],
  badge: "#d9b38c",
  title: "#fff1e3",
  separator: "#9a6b4a",
};

const themes = { blue, pink, red, brown };
export const themeNames = Object.freeze(Object.keys(themes));

export function getTheme(name = "blue") {
  if (typeof name === "string" && Object.hasOwn(themes, name)) return themes[name];
  throw new Error("Theme must be blue, pink, red, or brown");
}
