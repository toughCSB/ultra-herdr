import { createHash } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repository = dirname(fileURLToPath(import.meta.url));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export function validateRelease(release, root = repository) {
  if (!/^\d+\.\d+\.\d+$/.test(release.version) || !/^\d+\.\d+\.\d+$/.test(release.baseVersion)) throw new Error("Invalid release version");
  if (!release.source?.repository || !/^[a-f0-9]{40}$/.test(release.source.commit) || release.source.tag !== `v${release.baseVersion}`) throw new Error("Release needs an exact upstream commit and matching tag");
  const patch = release.patch;
  if (!patch?.file || isAbsolute(patch.file) || !resolve(root, patch.file).startsWith(resolve(root) + sep) || !/^[a-f0-9]{64}$/.test(patch.sha256)) throw new Error("Invalid release patch");
  if (digest(readFileSync(resolve(root, patch.file))) !== patch.sha256) throw new Error("Release patch SHA256 mismatch");
  if (release.toolchain?.zig !== "0.16.0" || !Array.isArray(release.tests) || !release.tests.length || release.tests.some(filter => typeof filter !== "string" || !filter.trim())) throw new Error("Release needs Zig 0.16.0 and native test filters");
  for (const platform of ["darwin-arm64", "win32-x64"]) {
    const asset = release.assets?.[platform];
    if (!asset?.file || basename(asset.file) !== asset.file || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error(`Invalid release asset: ${platform}`);
  }
  return resolve(root, patch.file);
}

export function releaseExitCode(checks) {
  if (checks.some(check => check.status === "failed")) return 1;
  return checks.some(check => check.status === "skipped") ? 3 : 0;
}

// Builds only in a new clone. Never edits or starts the installed Herdr runtime.
export async function verifyRelease({
  root = repository, manifest = JSON.parse(readFileSync(join(root, "client-release.json"), "utf8")),
  source = manifest.source?.repository, workdir = tmpdir(), targetDir, assetsDir,
  prepareOnly = false, skipBuild = false, downloadAssets = false,
  environment = process.env, onProgress = message => process.stderr.write(message + "\n"),
} = {}) {
  mkdirSync(workdir, { recursive: true });
  const work = mkdtempSync(join(workdir, "ultra-herdr-release-"));
  const native = join(work, "source");
  const checks = [];
  const report = { version: manifest.version, baseVersion: manifest.baseVersion,
    source: manifest.source, patch: manifest.patch, platform: `${process.platform}-${process.arch}`,
    work, checks, provenance: "Declared source and asset inputs; not a reproducible-binary attestation." };
  const skip = (name, reason) => checks.push({ name, status: "skipped", reason });
  const env = Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith("HERDR_") && !["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"].includes(key)));
  const testHome = join(work, "home");
  mkdirSync(testHome);
  Object.assign(env, { HOME: testHome, USERPROFILE: testHome, XDG_CONFIG_HOME: join(testHome, "config"),
    XDG_DATA_HOME: join(testHome, "data"), XDG_STATE_HOME: join(testHome, "state"),
    APPDATA: join(testHome, "roaming"), LOCALAPPDATA: join(testHome, "local"),
    CARGO_HOME: environment.CARGO_HOME || join(homedir(), ".cargo"), RUSTUP_HOME: environment.RUSTUP_HOME || join(homedir(), ".rustup"),
    CARGO_TARGET_DIR: targetDir ? resolve(targetDir) : join(work, "target"), GIT_PAGER: "cat" });
  function command(name, binary, args, { cwd = native, timeout = 1800000 } = {}) {
    onProgress(name);
    const log = join(work, `${name.replace(/[^a-z0-9-]/gi, "_")}.log`);
    const fd = openSync(log, "w");
    let result;
    try { result = spawnSync(binary, args, { cwd, env, stdio: ["ignore", fd, fd], windowsHide: true, timeout }); }
    finally { closeSync(fd); }
    if (result.error || result.status !== 0) throw new Error(`${name}: ${result.error?.message || `exit ${result.status}`} (log: ${log})`);
    const output = readFileSync(log, "utf8");
    checks.push({ name, status: "passed", log });
    return output.trim();
  }
  try {
    const patch = validateRelease(manifest, root);
    checks.push({ name: "manifest-and-patch", status: "passed" });
    command("clone", "git", ["clone", "--no-hardlinks", "--no-checkout", "--", source, native], { cwd: work });
    command("checkout", "git", ["checkout", "--detach", manifest.source.commit]);
    if (command("upstream-commit", "git", ["rev-parse", "HEAD"]) !== manifest.source.commit || command("upstream-tag", "git", ["rev-parse", `${manifest.source.tag}^{commit}`]) !== manifest.source.commit) throw new Error("Upstream tag/commit mismatch");
    command("patch-check", "git", ["apply", "--check", patch]);
    command("patch-apply", "git", ["apply", patch]);
    if (prepareOnly) {
      skip("native-tests", "--prepare-only"); skip("native-build", "--prepare-only");
    } else {
      const zig = command("zig-version", env.ZIG || "zig", ["version"]);
      if (zig !== manifest.toolchain.zig) throw new Error(`Expected Zig ${manifest.toolchain.zig}, got ${zig}`);
      report.toolchain = { zig, cargo: command("cargo-version", "cargo", ["--version"]), rust: command("rust-version", "rustc", ["--version"]) };
      for (const filter of manifest.tests) {
        const output = command(`native-test-${filter}`, "cargo", ["test", "--locked", "--bin", "herdr", filter, "--", "--test-threads=1"]);
        const count = [...output.matchAll(/test result: ok\. (\d+) passed/g)].reduce((sum, match) => sum + Number(match[1]), 0);
        if (!count) throw new Error(`Native filter ran no passing tests: ${filter}`);
        checks.at(-1).passedTests = count;
      }
      if (skipBuild) skip("native-build", "--skip-build");
      else command("native-build", "cargo", ["build", "--release", "--locked", "--bin", "herdr"]);
    }
    // A native host build does not validate the other OS's conditional code.
    skip("other-platform-build", process.platform === "win32" ? "requires darwin-arm64 host" : "requires win32-x64 host");
    for (const [platform, asset] of Object.entries(manifest.assets)) {
      let bytes;
      if (assetsDir) bytes = readFileSync(join(assetsDir, asset.file));
      else if (downloadAssets) {
        const response = await fetch(`https://github.com/toughCSB/ultra-herdr/releases/download/v${manifest.version}/${asset.file}`);
        if (!response.ok) throw new Error(`Asset download failed: HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
      } else { skip(`asset-${platform}`, "provide --assets-dir or --download-assets"); continue; }
      if (digest(bytes) !== asset.sha256) throw new Error(`Asset SHA256 mismatch: ${platform}`);
      checks.push({ name: `asset-${platform}`, status: "passed", sha256: asset.sha256 });
    }
  } catch (error) { checks.push({ name: "verification", status: "failed", reason: error.message }); }
  report.exitCode = releaseExitCode(checks);
  writeFileSync(join(work, "report.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { source: { type: "string" }, workdir: { type: "string" }, "target-dir": { type: "string" },
    "assets-dir": { type: "string" }, "prepare-only": { type: "boolean" }, "skip-build": { type: "boolean" },
    "download-assets": { type: "boolean" }, help: { type: "boolean" } }, strict: true });
  if (values.help) console.log("node release-check.mjs [--source PATH|URL] [--workdir PARENT] [--target-dir CACHE] [--assets-dir DIR|--download-assets] [--prepare-only] [--skip-build]\nRequires git, Rust/Cargo, and ZIG pointing to Zig 0.16.0; actual toolchain versions are recorded. Exit: 0 passed, 1 failed, 3 passed with explicitly skipped checks.");
  else {
    const report = await verifyRelease({ source: values.source, workdir: values.workdir, targetDir: values["target-dir"], assetsDir: values["assets-dir"],
      prepareOnly: values["prepare-only"], skipBuild: values["skip-build"], downloadAssets: values["download-assets"] });
    console.log(JSON.stringify(report, null, 2)); process.exitCode = report.exitCode;
  }
}
