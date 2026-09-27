const blue = {
  colors: {
    panel_bg: "#000000",
    sidebar_bg: "#1d4263",
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
  badge: "#7fdfff",
  title: "#d3ecfb",
  separator: "#6f97b8",
};

const pink = {
  colors: {
    ...blue.colors,
    sidebar_bg: "#9e125c",
    overlay0: "#ffc6e5",
    overlay1: "#fff0f8",
    subtext0: "#ffe1f1",
    accent: "#ff91ca",
    active_row_bg: "#bd206f",
    selection_bg: "#cc3489",
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
