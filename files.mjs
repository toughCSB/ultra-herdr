import * as fs from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

function contents(path, io, kind = "file") {
  try { return kind === "link" ? io.readlinkSync(path) : io.readFileSync(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

const same = (a, b) => Buffer.isBuffer(a) && Buffer.isBuffer(b) ? a.equals(b) : a === b;

// Capture once during preparation; commit and recovery never overwrite a newer edit.
export function fileChange(path, updated, io = fs) {
  try { if (io.lstatSync(path).isSymbolicLink()) path = io.realpathSync(path); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const original = contents(path, io);
  const mode = original === null ? 0o600 : io.statSync(path).mode & 0o777;
  return { path, original, updated: Buffer.from(typeof updated === "function" ? updated(original) : updated), mode, kind: "file" };
}

export function linkChange(path, target, io = fs) {
  const original = contents(path, io, "link"); // A regular file is never replaced.
  return { path, original, updated: target, kind: "link" };
}

// File preparation and recovery only. External activation happens AFTER this returns.
// This is conflict-aware recovery, not an atomic transaction across files/processes.
export function commitFiles(changes, { validate = () => {}, io = fs } = {}) {
  if (new Set(changes.map(item => item.path)).size !== changes.length) throw new Error("Duplicate file change");
  const pending = changes.filter(item => !same(item.original, item.updated));
  const staged = new Map();
  const written = [];
  let failure;
  const temporary = path => `${path}.ultra-herdr-${process.pid}-${randomUUID()}`;
  const assertUnchanged = item => {
    if (!same(contents(item.path, io, item.kind), item.original)) throw new Error(`File changed while preparing settings: ${item.path}`);
  };
  const stage = (item, path, value) => item.kind === "link"
    ? io.symlinkSync(value, path, "dir")
    : io.writeFileSync(path, value, { flag: "wx", mode: item.mode });
  try {
    for (const item of changes) {
      assertUnchanged(item);
      io.mkdirSync(dirname(item.path), { recursive: true });
      const path = temporary(item.path);
      staged.set(item.path, path);
      stage(item, path, item.updated);
    }
    validate(staged);
    for (const item of changes) assertUnchanged(item);
    // Remove validation-only staging before any durable write. Successful commits
    // then have no cleanup step that could masquerade as a failed file save.
    for (const item of changes) {
      if (!pending.includes(item)) {
        io.unlinkSync(staged.get(item.path));
        staged.delete(item.path);
      }
    }
    for (const item of pending) {
      assertUnchanged(item);
      io.renameSync(staged.get(item.path), item.path);
      staged.delete(item.path);
      written.push(item);
    }
    return { changed: pending.length };
  } catch (error) {
    failure = error;
    const recovery = [];
    for (const item of written.reverse()) {
      try {
        if (!same(contents(item.path, io, item.kind), item.updated)) throw new Error(`Recovery conflict; preserved newer contents: ${item.path}`);
        if (item.original === null) io.unlinkSync(item.path);
        else {
          const path = temporary(item.path);
          staged.set(item.path, path);
          stage(item, path, item.original);
          io.renameSync(path, item.path);
          staged.delete(item.path);
        }
      } catch (failure) { recovery.push(failure); }
    }
    if (recovery.length) throw new AggregateError([error, ...recovery], `Settings failed; recovery incomplete: ${recovery.map(item => item.message).join("; ")}`, { cause: error });
    throw error;
  } finally {
    for (const path of staged.values()) {
      try { io.unlinkSync(path); }
      catch (error) {
        if (error.code !== "ENOENT") {
          if (failure) (failure.cleanupErrors ||= []).push(error);
          else throw error;
        }
      }
    }
  }
}

export function activationError(failed, cause, subject = "Settings") {
  const messages = error => error?.errors ? [...error.errors].flatMap(messages)
    : error?.persisted && error.cause ? messages(error.cause)
      : error?.message ? [error.message] : [];
  const detail = [...new Set(messages(cause))].join("; ");
  const error = new Error(`${subject} saved; activation incomplete (${failed.join(", ")})${detail ? `: ${detail}` : ""}. Resolve the reported cause, then retry.`, { cause });
  error.persisted = true;
  error.failed = failed;
  return error;
}
