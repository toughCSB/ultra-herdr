import assert from "node:assert/strict";
import { test } from "node:test";
import { clientAsset, ghosttyClientConfig } from "./client.mjs";

test("release selects the execution platform and rejects unsupported architectures", () => {
  assert.equal(clientAsset("darwin", "arm64").file, "herdr-client-darwin-arm64.tar.gz");
  assert.equal(clientAsset("win32", "x64").file, "herdr-client-win32-x64.zip");
  assert.throws(() => clientAsset("linux", "x64"), /does not support/);
});

test("client updates change only the launcher command and retain theme and font", () => {
  const source = "command = direct:/old/herdr\nfont-size = 13\nbackground = #fffafa\n";
  assert.equal(ghosttyClientConfig(source, "/new/herdr"),
    "command = direct:/new/herdr\nfont-size = 13\nbackground = #fffafa\n");
  assert.throws(() => ghosttyClientConfig("font-size = 13\n", "/new"), /no command/);
});
