import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateRelease, verifyRelease, releaseExitCode } from "./release-check.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ultra-release-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "upstream"); mkdirSync(source);
  const env = { ...process.env, GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" };
  const git = args => execFileSync("git", args, { cwd: source, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git(["init"]); writeFileSync(join(source, "source.txt"), "before\n"); git(["add", "source.txt"]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "fixture"]); git(["tag", "v0.9.5"]);
  const commit = git(["rev-parse", "HEAD"]);
  writeFileSync(join(source, "source.txt"), "after\n");
  const patch = git(["diff"]) + "\n"; writeFileSync(join(root, "full.patch"), patch);
  const sha = text => createHash("sha256").update(text).digest("hex");
  const assets = { "darwin-arm64": { file: "mac.tar.gz", sha256: sha("mac") }, "win32-x64": { file: "win.zip", sha256: sha("win") } };
  writeFileSync(join(root, "mac.tar.gz"), "mac"); writeFileSync(join(root, "win.zip"), "win");
  const manifest = { version: "3.0.27", baseVersion: "0.9.5", source: { repository: source, tag: "v0.9.5", commit }, patch: { file: "full.patch", sha256: sha(patch) }, toolchain: { zig: "0.16.0" }, tests: ["archive_"], assets };
  return { root, source, manifest, git };
}

test("release preparation verifies pinned source, applies the exact patch and checks assets without touching source checkout", async t => {
  const f = fixture(t);
  const before = f.git(["status", "--porcelain=v1"]);
  const report = await verifyRelease({ root: f.root, source: f.source, manifest: f.manifest, workdir: f.root, assetsDir: f.root, prepareOnly: true, onProgress: () => {} });
  assert.equal(report.exitCode, 3);
  assert.ok(report.checks.some(check => check.name === "patch-apply" && check.status === "passed"));
  assert.ok(report.checks.some(check => check.name === "native-build" && check.status === "skipped"));
  assert.equal(readFileSync(join(report.work, "source/source.txt"), "utf8").replace(/\r\n/g, "\n"), "after\n");
  assert.equal(f.git(["status", "--porcelain=v1"]), before);
  assert.equal(f.git(["rev-parse", "HEAD"]), f.manifest.source.commit);
});

test("release validation rejects tampered patch before cloning", async t => {
  const f = fixture(t); writeFileSync(join(f.root, "full.patch"), "tampered");
  assert.throws(() => validateRelease(f.manifest, f.root), /SHA256 mismatch/);
  const report = await verifyRelease({ root: f.root, manifest: f.manifest, workdir: f.root, prepareOnly: true, onProgress: () => {} });
  assert.equal(report.exitCode, 1);
  assert.equal(report.checks.length, 1);
});

test("release asset mismatch is a failure even when build checks were explicitly skipped", async t => {
  const f = fixture(t); writeFileSync(join(f.root, "win.zip"), "wrong asset");
  const report = await verifyRelease({ root: f.root, source: f.source, manifest: f.manifest, workdir: f.root, assetsDir: f.root, prepareOnly: true, onProgress: () => {} });
  assert.equal(report.exitCode, 1);
  assert.match(report.checks.at(-1).reason, /Asset SHA256 mismatch: win32-x64/);
});

test("release check never calls skipped checks passed", () => {
  assert.equal(releaseExitCode([{ status: "passed" }]), 0);
  assert.equal(releaseExitCode([{ status: "passed" }, { status: "skipped" }]), 3);
  assert.equal(releaseExitCode([{ status: "skipped" }, { status: "failed" }]), 1);
});
