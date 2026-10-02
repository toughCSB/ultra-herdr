// Glyph assignments adapted from herdr-radar (MIT); see THIRD_PARTY_NOTICES.md.
// Herdr Agent Icons Max is installed in ~/Library/Fonts, not loaded from Radar.
export const providers = {
  claude: ["\ue1a0", "Claude", "#ff9a64"],
  codex: ["\ue1a1", "Codex", "#ffffff"],
  opencode: ["\ue1a2", "OpenCode", "#ffffff"],
  omp: ["\ue1a3", "OMP", "#9db5ff"],
  cline: ["\ue1a4", "Cline", "#b9cdda"],
  mastracode: ["\ue1a5", "Mastra", "#ffffff"],
  kimi: ["\ue1a6", "Kimi", "#75b6ff"],
  kilo: ["\ue1a7", "Kilo", "#e4ce79"],
  maki: ["\ue1a8", "Maki", "#ffffff"],
  pi: ["\ue1a9", "Pi", "#6cdaff"],
  omo: ["\ue1a9", "OmO", "#6cdaff"],
  hermes: ["\ue1aa", "Hermes", "#e7bd94"],
  cursor: ["\ue1ab", "Cursor", "#ffffff"],
  copilot: ["\ue1ac", "Copilot", "#b9c4ff"],
  deepseek: ["\ue1ad", "DeepSeek", "#99b4ff"],
  gemini: ["\ue1ae", "Gemini", "#7fb4ff"],
  gpt: ["\ue1af", "GPT", "#ffffff"],
  qwen: ["\ue1b0", "Qwen", "#b5a6ff"],
  grok: ["\ue1b1", "Grok", "#e1b4ff"],
  agy: ["\ue1b2", "Antigravity", "#ffffff"],
  kiro: ["\ue1b3", "Kiro", "#c09aff"],
  amp: ["\ue1b4", "Amp", "#ffffff"],
  devin: ["\ue1b5", "Devin", "#ffffff"],
  qodercli: ["\ue1b6", "Qoder", "#ffffff"],
  glm: ["\ue1b7", "GLM", "#96d6ff"],
};

export function providerLabel(agent) {
  if (!agent) return "";
  const declared = agent.display_agent?.trim().toLowerCase();
  const id = Object.hasOwn(providers, declared ?? "") ? declared : agent.agent?.toLowerCase();
  const provider = Object.hasOwn(providers, id ?? "") ? providers[id] : undefined;
  return provider ? `${provider[0]} ${provider[1]}` : (agent.agent || "");
}

export function providerTokenCell(token = "$skyline_provider", theme) {
  const defaultColor = theme?.providerDefault ?? "#ffffff";
  const rules = Object.entries(providers).map(([id, [glyph, name, color]]) => ({
    glyph,
    name,
    color: theme?.providerDefault
      ? theme.providerColors?.[id] ?? defaultColor
      : color,
  })).filter(({ color }) => color !== defaultColor);
  return `{ token = "${token}", bold = true, fg = "${defaultColor}", rules = [${
  rules.map(({ glyph, name, color }) => `{ equals = "${glyph} ${name}", fg = "${color}" }`).join(", ")
}] }`;
}

export const providerCell = providerTokenCell();
// 13 provider rows, two cells each, plus title/git-divider: within Herdr's 16-row limit.
export const workspaceProviderKeys = Array.from({ length: 26 }, (_, index) => `ultra_provider_${index + 1}`);

export function workspaceProviders(agents) {
  const labels = [...new Set(agents.map(providerLabel).filter(Boolean))];
  return Object.fromEntries(workspaceProviderKeys.map((key, index) => [
    key, index === workspaceProviderKeys.length - 1
      ? labels.slice(index).join(" / ")
      : labels[index] || "",
  ]));
}
