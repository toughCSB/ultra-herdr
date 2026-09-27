import assert from "node:assert/strict";
import { test } from "node:test";
import { providerCell, providerLabel, providers, workspaceProviders } from "./providers.mjs";

test("recognized wrapper brand overrides harness but a task title never does", () => {
  assert.equal(providerLabel({ agent: "claude", display_agent: "GLM" }), "\ue1b7 GLM");
  assert.equal(providerLabel({ agent: "pi", display_agent: "Fix the build" }), "\ue1a9 Pi");
  assert.equal(providerLabel({ agent: "omo", display_agent: "Fix the build" }), "\ue1a9 OmO");
});

test("unknown or absent agents never inherit another vendor icon", () => {
  assert.equal(providerLabel({ agent: "new-agent" }), "new-agent");
  assert.equal(providerLabel(undefined), "");
  assert.equal(providerLabel({ agent: "__proto__" }), "__proto__");
});

test("all provider codepoints fit the installed font and Herdr rule limit", () => {
  assert.ok(Object.values(providers).every(([glyph]) => glyph.codePointAt(0) >= 0xe1a0 && glyph.codePointAt(0) <= 0xe1b7));
  assert.ok((providerCell.match(/equals =/g) || []).length <= 16);
});

test("workspace providers retain distinct brands and collapse duplicate sessions", () => {
  const values = workspaceProviders([
    { agent: "claude" }, { agent: "claude" }, { agent: "pi" },
    { agent: "claude", display_agent: "GLM" },
  ]);
  assert.deepEqual(Object.values(values).filter(Boolean), ["\ue1a0 Claude", "\ue1a9 Pi", "\ue1b7 GLM"]);
  assert.ok(Object.values(workspaceProviders([])).every((value) => value === ""));
});
