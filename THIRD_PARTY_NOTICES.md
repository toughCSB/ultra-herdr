# Provider icon provenance

The glyph assignments in `providers.mjs` and the independently installed
`assets/fonts/HerdrAgentIconsMax.ttf` come from
[hhdebb/herdr-radar](https://github.com/hhdebb/herdr-radar), a fork of
[qintmb/herdr-icon-agent-ui](https://github.com/qintmb/herdr-icon-agent-ui).
ultra-herdr uses only the provider glyph assignments and standalone icon font;
it does not require Radar's runtime, ordering, state animator, or configuration.

## MIT License

Copyright (c) 2025 qintmb
Copyright (c) 2026 herdr-kit contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Marks

Marks identify third-party products and do not imply affiliation or endorsement.
Source attribution retained from Radar:

| Icon | Source or owner |
|---|---|
| claude | Anthropic `cwc-workshops` (Apache-2.0) |
| codex | OpenAI `codex` (Apache-2.0) |
| opencode | anomalyco `opencode` (MIT) |
| omp | can1357 `oh-my-pi` (MIT) |
| cline | Cline (MIT) |
| mastracode | MastraCode (MIT) |
| kimi | Moonshot AI Kimi Code CLI (Apache-2.0) |
| kilo | Kilo Code CLI (Apache-2.0) |
| maki | Maki (MIT) |
| pi | Pi coding agent |
| hermes | Hermes Agent |
| cursor | Cursor (proprietary) |
| copilot | GitHub Copilot (proprietary) |
| deepseek | DeepSeek (proprietary) |
| gemini | Google Gemini (proprietary) |
| gpt | OpenAI (proprietary) |
| qwen | Alibaba Qwen (proprietary) |
| grok | xAI Grok (proprietary) |
| agy | Google Antigravity (proprietary) |
| kiro | AWS Kiro (proprietary) |
| glm | Z.ai / GLM (proprietary) |
| amp | Amp (proprietary) |
| devin | Cognition Devin (proprietary) |
| qodercli | Alibaba Qoder (proprietary) |

Marks for cursor, opencode, hermes, copilot, deepseek, gemini, gpt, qwen, agy,
kiro, and glm were taken from [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons)
(MIT) and re-normalized by Radar to bare path geometry. The license covers
packaging, not the trademarks. The standalone Herdr Agent Icons Max font
contains no JetBrains Mono outlines.

## Senpi / pi-mono

`integrations/omo/herdr-senpi.mjs` is adapted from Senpi's built-in Herdr
integration. `omo-blue.json` retains a palette structure derived from the
Pi/Senpi custom-theme format. Their MIT attribution is preserved in
[third-party/SENPI_LICENSE](third-party/SENPI_LICENSE).

Source: https://github.com/code-yeongyu/senpi
Upstream: https://github.com/badlogic/pi-mono

The OMO runtime, Node, Herdr, Ghostty, Windows Terminal, and Jetendard main
font are not bundled. Their own licenses apply to their installations.
