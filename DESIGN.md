# ultra-herdr theme integration

## RED reference contract

Reference: https://images.media.io/colors/satin-poppy-black-red-color-palette.jpg

The supplied swatches are the color contract, not a new layout:
`#0B0B0E` ink black, `#26262B` charcoal, `#C81D25` poppy red,
`#FF595E` coral red, and `#FFF0F3` satin white.
RED uses ink for the pane, charcoal for the sidebar and OMO tool surfaces,
poppy for selected rows, coral for accents and dividers, and satin white for
text and the user-message surface. Error-tool backing `#331015` is a dark
red tint so semantic error text remains legible.

Fonts, density, grouping, provider colors, and lifecycle colors stay unchanged.
White text on poppy selection and coral text on charcoal must meet 4.5:1
contrast. Existing syntax and semantic colors are retained except blue UI
accents, links, and non-semantic code highlights mapped into the RED palette.
Blue/Pink values and round-trip restoration remain regression constraints.
No motion, layout, React, or browser-specific behavior is introduced.

`getTheme(name = "blue")` returns `{ colors, badge, title, separator }`.
The Blue `colors` object preserves all existing `[theme.custom]` keys and values.
Pink changes only the sidebar UI blue tones; `panel_bg`, `surface_dim`, `text`,
the red/yellow/green/teal semantic colors, the `unknown` state color, and
provider and machine identity colors remain unchanged.

Pink uses saturated clear pink rather than muted mauve: sidebar `#9e125c`,
active row `#bd206f`, selection `#cc3489`, bright highlights `#ff91ca`.
The main OMO pane must also coordinate message/tool backgrounds and accent
colors with the selected theme; changing only Herdr chrome is incomplete.
Version 3 is local-only: no target-PC picker, remote command execution, or
cross-PC theme synchronization. Settings affect the OS host running the plugin.
Native Herdr actions on remote workspaces still execute on that remote server;
the viewing PC must use its local launcher or a Local workspace.
Remote agent ANSI colors are not rewritten by a local theme choice.

The parent integration replaces the palette in `apply.mjs` with `getTheme(getThemeName())`
and uses `badge`, `title`, and `separator` for sidebar row foreground colors.
The branch glyph uses `badge`; the fixed `blocked`, `working`, `done`, `idle`,
and `unknown` rules and provider/machine overrides do not depend on the theme.
It exports `async applyCurrentTheme()` from `apply.mjs` for the settings popup;
the popup calls it only after validated input is submitted.

`getThemeName()` defaults to `blue` when the setting is absent, while an
unknown stored name is an error. `setThemeName(name)` checks the name before
writing and retains every other field in `settings.json`, including `fontSize`
and `localMachineLabel`. Without `HERDR_PLUGIN_CONFIG_DIR`, the directory is
`local.ultra-herdr` under the platform's Herdr plugin config root. The parent
migrates existing settings before deployment.

The popup gathers both values before changing font or theme settings. `q` in
either prompt cancels without writes. A changed font size retains the existing
Ghostty and Windows Terminal behavior; applying the theme is delegated to
`applyCurrentTheme(name, size)`. Presets do not change font sizes.
