import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scripts = path.dirname(fileURLToPath(import.meta.url));

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gamenet-release-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, "repo");
  const remote = path.join(dir, "remote.git");
  fs.mkdirSync(repo);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--bare", remote);
  git("init", "-b", "main");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  git("config", "core.hooksPath", path.join(dir, "no-hooks"));
  fs.mkdirSync(path.join(repo, "scripts"));
  for (const name of ["release.mjs", "bump-version.mjs"]) {
    fs.copyFileSync(path.join(scripts, name), path.join(repo, "scripts", name));
  }
  for (const [folder, pkg] of [
    ["packages/gamenet", { name: "@test/core", version: "0.0.1" }],
    [
      "apps/example",
      {
        name: "@test/app",
        private: true,
        version: "0.0.1",
        dependencies: { "@test/core": "0.0.1" },
        devDependencies: { "@test/core": "workspace:*" },
      },
    ],
  ]) {
    const location = path.join(repo, ...folder.split("/"));
    fs.mkdirSync(location, { recursive: true });
    fs.writeFileSync(path.join(location, "package.json"), JSON.stringify(pkg));
  }
  git("add", ".");
  git("commit", "-m", "Initial commit");
  git("remote", "add", "origin", remote);
  git("push", "origin", "main");
  const initial = git("rev-parse", "HEAD");
  const run = (...args) =>
    spawnSync(
      process.execPath,
      [path.join(repo, "scripts", "release.mjs"), ...args],
      {
        cwd: os.tmpdir(),
        encoding: "utf8",
      }
    );
  const runWithInput = (input) =>
    spawnSync(process.execPath, [path.join(repo, "scripts", "release.mjs")], {
      cwd: os.tmpdir(),
      encoding: "utf8",
      input,
      timeout: 10000,
    });
  return { repo, remote, git, initial, run, runWithInput };
}

test("bumps workspace versions and dependencies, commits, tags, and pushes", (t) => {
  const { repo, git, run } = fixture(t);
  const result = run("0.0.2-rc.1");
  assert.equal(result.status, 0, result.stderr);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repo, "apps", "example", "package.json"))
  );
  assert.equal(pkg.version, "0.0.2-rc.1");
  assert.equal(pkg.dependencies["@test/core"], "0.0.2-rc.1");
  assert.equal(pkg.devDependencies["@test/core"], "workspace:*");
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(git("log", "-1", "--format=%s"), "chore: release v0.0.2-rc.1");
  assert.match(git("log", "-1", "--format=%b"), /Co-authored-by: Copilot/);
  const head = git("rev-parse", "HEAD");
  assert.equal(git("rev-parse", "v0.0.2-rc.1"), head);
  const refs = git(
    "ls-remote",
    "origin",
    "refs/heads/main",
    "refs/tags/v0.0.2-rc.1"
  );
  assert.equal(refs.split("\n").length, 2);
  assert.ok(refs.split("\n").every((line) => line.startsWith(head)));
});

test("rejects invalid or extra version arguments without changes", (t) => {
  const { git, initial, run } = fixture(t);
  for (const args of [
    ["v0.0.2"],
    ["01.0.2"],
    ["0.0.2-01"],
    ["0.0.2", "extra"],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
    assert.equal(git("rev-parse", "HEAD"), initial);
    assert.equal(git("status", "--porcelain"), "");
  }
});

test("suggests the next patch from the highest local or remote version tag", (t) => {
  const { git, runWithInput } = fixture(t);
  git("tag", "v1.9.99");
  git("tag", "v2.0.9");
  git("tag", "-a", "v2.0.10", "-m", "Remote release");
  git("push", "origin", "v2.0.10");
  git("tag", "-d", "v2.0.10");
  git("tag", "v2.0.12-rc.1");
  git("tag", "v02.0.99");
  git("tag", "unrelated");
  const result = runWithInput("yes\n");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release v2\.0\.13\? \[y\/N\]/);
  assert.equal(git("rev-parse", "v2.0.13"), git("rev-parse", "HEAD"));
});

test("uses a remote-only annotated tag when it is the highest version", (t) => {
  const { git, runWithInput } = fixture(t);
  git("tag", "v0.0.9");
  git("tag", "-a", "v0.0.10", "-m", "Remote release");
  git("push", "origin", "v0.0.10");
  git("tag", "-d", "v0.0.10");
  const result = runWithInput("Y\n");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release v0\.0\.11\?/);
  assert.equal(git("rev-parse", "v0.0.11"), git("rev-parse", "HEAD"));
});

test("falls back to the core package version when no version tags exist", (t) => {
  const { git, runWithInput } = fixture(t);
  git("tag", "unrelated");
  const result = runWithInput("y\n");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release v0\.0\.2\?/);
  assert.equal(git("rev-parse", "v0.0.2"), git("rev-parse", "HEAD"));
});

test("declining, empty input, unrecognized input, and EOF cancel without changes", (t) => {
  const { git, initial, runWithInput } = fixture(t);
  for (const input of ["n\n", "\n", "maybe\n", ""]) {
    const result = runWithInput(input);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Release cancelled/);
    assert.equal(git("rev-parse", "HEAD"), initial);
    assert.equal(git("status", "--porcelain"), "");
    assert.equal(git("tag", "--list"), "");
    assert.ok(
      git("ls-remote", "origin", "refs/heads/main").startsWith(initial)
    );
  }
});

test("rejects dirty working trees and non-main branches", (t) => {
  const { repo, git, initial, run } = fixture(t);
  const dirty = path.join(repo, "untracked.txt");
  fs.writeFileSync(dirty, "keep me");
  assert.match(run("0.0.2").stderr, /Working tree must be clean/);
  assert.equal(fs.readFileSync(dirty, "utf8"), "keep me");
  fs.unlinkSync(dirty);
  git("checkout", "-b", "feature");
  assert.match(run("0.0.2").stderr, /Releases must be made from main/);
  assert.equal(git("rev-parse", "HEAD"), initial);
});

test("rejects existing local and remote tags before bumping", (t) => {
  const { git, initial, run } = fixture(t);
  git("tag", "v0.0.2");
  assert.match(run("0.0.2").stderr, /already exists locally/);
  git("push", "origin", "v0.0.2");
  git("tag", "-d", "v0.0.2");
  assert.match(run("0.0.2").stderr, /already exists on origin/);
  assert.equal(git("rev-parse", "HEAD"), initial);
  assert.equal(git("status", "--porcelain"), "");
});

test("rejects a branch behind origin", (t) => {
  const { git, initial, run } = fixture(t);
  git("commit", "--allow-empty", "-m", "Remote change");
  git("push", "origin", "main");
  git("reset", "--hard", initial);
  const result = run("0.0.2");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /behind or diverged/);
  assert.equal(git("status", "--porcelain"), "");
});

test("does not create a commit or tag when the version is unchanged", (t) => {
  const { git, run } = fixture(t);
  assert.equal(run("0.0.2").status, 0);
  git("tag", "-d", "v0.0.2");
  git("push", "origin", ":refs/tags/v0.0.2");
  const head = git("rev-parse", "HEAD");
  const result = run("0.0.2");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No version changes/);
  assert.equal(git("rev-parse", "HEAD"), head);
  assert.equal(git("tag", "--list", "v0.0.2"), "");
});

test("preserves local release state if the atomic push is rejected", (t) => {
  const { remote, git, initial, run } = fixture(t);
  execFileSync("git", [
    "--git-dir",
    remote,
    "config",
    "receive.denyNonFastForwards",
    "true",
  ]);
  execFileSync("git", [
    "--git-dir",
    remote,
    "config",
    "receive.advertiseAtomic",
    "false",
  ]);
  const result = run("0.0.2");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /atomic/);
  assert.notEqual(git("rev-parse", "HEAD"), initial);
  assert.equal(git("rev-parse", "v0.0.2"), git("rev-parse", "HEAD"));
  assert.ok(git("ls-remote", "origin", "refs/heads/main").startsWith(initial));
  assert.equal(git("ls-remote", "origin", "refs/tags/v0.0.2"), "");
});
