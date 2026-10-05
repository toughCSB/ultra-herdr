# ultra-herdr theme integration

## Sidebar identity and density

Every agent entry retains a nonempty identity row: the first workspace member
has the bold machine/project heading, and later members have a normal-weight
machine/project identity. Herdr 0.9.1 indents the first visible row by one cell
and later rows by three; keeping that row aligns all branch glyphs. Its single
row template also requires the identity on each entry for Priority sorting.
Applying a palette preserves the user's current agent sort selection.

Workspace headings include a detected agent-session count, including multiple
sessions using the same provider. Zero sessions clears the count token.
Machines retain the state icon and thin divider, but omit the redundant state
text row. Branch and git status share the divider row, before its rule, so Git
and non-Git entries both save one terminal row without hiding Git information.
Pink orders state icon/message before provider identity and uses the original
Radar vendor swatches; Blue and RED retain their existing provider map.

The optional `$ultra_activity` cell precedes agent identity and accompanies the
native workspace status icon. Only real Working agents animate; native
idle/done/blocked/unknown indicators remain authoritative and unchanged.
Activity metadata is owned separately from project/provider labels.

## RED reference contract

Reference: https://images.media.io/colors/satin-poppy-black-red-color-palette.jpg

The supplied swatches are the color contract, not a new layout:
`#0B0B0E` ink black, `#26262B` charcoal, `#C81D25` poppy red,
`#FF595E` coral red, and `#FFF0F3` satin white.
RED uses ink for the pane, charcoal for the sidebar and OMO tool surfaces,
poppy for selected rows, coral for accents and dividers, and satin white for
text. User-message surfaces use bright red `#ffb3b8` with `#650d18` text;
code surfaces use pale lavender `#e9ddff` with `#302044` text. Blue code
surfaces use deep blue `#123b70` with `#e1efff` text. Error-tool backing `#331015` is a dark
red tint so semantic error text remains legible.

Fonts, density, and grouping stay unchanged. Lifecycle colors remain semantic.
White text on poppy selection and coral text on charcoal must meet 4.5:1
contrast. Existing syntax and semantic colors are retained except blue UI
accents, links, and non-semantic code highlights mapped into the RED palette.
Blue/Pink values and round-trip restoration remain regression constraints.
Motion is limited to the Working activity indicator; palette changes introduce
no other animation, layout, React, or browser-specific behavior.

`getTheme(name = "blue")` returns the sidebar palette fields; Pink adds the
sidebar text and provider-color overrides.
The Blue `colors` object preserves all existing `[theme.custom]` keys and values.
Pink uses a light terminal background `#fffafa` with dark text `#30252b`
and restores provider brand swatches. User-message background `#f4a0bf`
with text `#480d30` is stronger than the sidebar selection.

Pink follows the supplied sidebar reference only: background `#ffebea` and
active row `#febab9`, preserving the sidebar geometry. Ordinary sidebar text, headings,
dividers and frame use `#480d30`. Provider tokens use the saved Radar brand
swatches (dark ink fallback). Sidebar state icons retain their existing
semantic roles; Pink done/idle use dark green `#168a45`, and Working
icons/text/activity use dark orange `#d65a00`.
Blue/RED colors and their OMO behavior remain unchanged.
Agent rows order state icon/text before provider identity.
The Herdr 0.9.1 companion renderer only recolors sidebar cells outside provider,
status and activity glyph/color sets. Mobile and navigator views keep their
original status indicators. Pink OMO text/syntax and tool surfaces use
dark foregrounds on light pink backgrounds. Mac and Windows share these tokens.
No server state, API schema or wire protocol changes are needed.
Pink application updates the full `[theme.custom]` palette, managed sidebar
block, local terminal default foreground/background, and local OMO theme.
Version 3 is local-only: no target-PC picker, remote command execution, or
cross-PC theme synchronization. Settings affect the OS host running the plugin.
Native Herdr actions on remote workspaces still execute on that remote server;
the viewing PC must use its local launcher or a Local workspace.
Remote agent ANSI colors are not rewritten by a local theme choice.

The integration applies `getTheme(getThemeName())` in `apply.mjs`. Pink uses the
legacy Radar provider swatches with dark ink fallback; Blue and RED retain their
existing provider map. Pink status glyphs are filled circles in the established
semantic colors, with status text placed before provider identity.
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

## Terminal surface ownership (3.0.15)

The plugin publishes optional `ultra_code_block_bg` / `ultra_code_block_fg`
and `ultra_user_message_bg` / `ultra_user_message_fg` tokens per workspace.
The companion resolves each pane owner independently of the viewer and focus.
Unsupported apps and missing/invalid tokens preserve native presentation.
Code fences and indented multi-color syntax are recognized from original cells;
plain prose is not sufficient evidence. Semantic diff backgrounds and active
prompts are excluded. User cards take priority over code decoration; selection
is applied last. Recognition changes can affect untouched rows, so incremental
patches use full composition when these overlays are enabled.

### Wide glyphs and retained updates (3.0.16)

A wide glyph owns its covered terminal cells even when a retained update resets
the covered cell to a default blank with `skip=false`. Message recognition uses
Unicode display width and checks only visible glyph cells. It does not ignore
ordinary spaces or semantic backgrounds. Explicit-background blank padding and
paragraph breaks belong to the recognized message; default-background whitespace
still ends it. The source cells remain unchanged. A live masked CJK fixture and
a sparse retained-update replay cover the full-frame-to-patch regression.

Mac launchers use an atomically selected `current/herdr` symlink so a cached
Ghostty command resolves the current installed client when opening a new window.
Existing clients still need reopening after the initial stable-path migration.

### Pink control surfaces (3.0.17)

Pink owns surface0 (#f5dce8) and surface1 (#fbe8f1) as well as panel_bg.
These tokens are used by rename/new-tab inputs, neutral buttons and inactive
tab labels. All text, overlay0 and overlay1 combinations meet 4.5:1 contrast.
Blue and RED explicitly restore the former Tokyo Night fallback values
#24283b / #414868 when switching away from Pink. Active controls keep their
existing accent background and panel-contrast foreground. No companion
runtime change is required; plugin 3.0.17 uses companion 3.0.16.
