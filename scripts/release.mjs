import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

function git(...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function suggestVersion() {
  const localTags = git("tag", "--list").split("\n");
  const remoteTags = git("ls-remote", "--tags", "--refs", "origin")
    .split("\n")
    .map((line) => line.split("\t")[1]?.replace(/^refs\/tags\//, ""));
  let highest;
  for (const tag of [...localTags, ...remoteTags]) {
    if (!tag?.startsWith("v")) continue;
    const match = semver.exec(tag.slice(1));
    if (!match) continue;
    const parts = match.slice(1, 4).map((part) => BigInt(part));
    const difference = highest
      ? parts.findIndex((part, index) => part !== highest[index])
      : -1;
    if (
      !highest ||
      (difference !== -1 && parts[difference] > highest[difference])
    ) {
      highest = parts;
    }
  }
  if (!highest) {
    const { version } = JSON.parse(
      fs.readFileSync(
        path.join(root, "packages", "gamenet", "package.json"),
        "utf8"
      )
    );
    const match = semver.exec(version);
    if (!match) throw new Error("Core package version is not valid SemVer.");
    highest = match.slice(1, 4).map((part) => BigInt(part));
  }
  return `${highest[0]}.${highest[1]}.${highest[2] + 1n}`;
}

async function confirmVersion(version) {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await new Promise((resolve) => {
      prompt.once("close", () => resolve(""));
      prompt.question(`Release v${version}? [y/N] `, resolve);
    });
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

async function release() {
  let version = process.argv[2];
  if (
    process.argv.length > 3 ||
    (version !== undefined && !semver.test(version))
  ) {
    throw new Error("Usage: node scripts/release.mjs [version] (e.g. 0.0.8)");
  }

  if (version === undefined) {
    version = suggestVersion();
    if (!(await confirmVersion(version))) {
      console.log("Release cancelled. No changes made.");
      return;
    }
  }

  const tag = `v${version}`;
  if (git("status", "--porcelain")) {
    throw new Error(
      "Working tree must be clean. Commit or stash changes first."
    );
  }
  if (git("branch", "--show-current") !== "main") {
    throw new Error("Releases must be made from main.");
  }
  if (git("tag", "--list", tag)) {
    throw new Error(`Tag ${tag} already exists locally.`);
  }
  if (git("ls-remote", "--tags", "origin", `refs/tags/${tag}`)) {
    throw new Error(`Tag ${tag} already exists on origin.`);
  }
  git("fetch", "origin", "main");
  try {
    git("merge-base", "--is-ancestor", "FETCH_HEAD", "HEAD");
  } catch {
    throw new Error("main is behind or diverged from origin/main. Pull first.");
  }

  execFileSync(
    process.execPath,
    [path.join(root, "scripts", "bump-version.mjs"), version],
    {
      cwd: root,
      stdio: "inherit",
    }
  );
  git("add", "--", "packages/*/package.json", "apps/*/package.json");
  if (!git("diff", "--cached", "--name-only")) {
    throw new Error(`No version changes to commit for ${version}.`);
  }
  console.log(
    git(
      "commit",
      "-m",
      `chore: release ${tag}`,
      "-m",
      "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    )
  );
  git("tag", tag);
  git("push", "--atomic", "origin", "refs/heads/main", `refs/tags/${tag}`);
  console.log(`Released ${tag}: pushed main and tag to origin.`);
}

release().catch((error) => {
  console.error(`Release failed: ${error.message}`);
  process.exitCode = 1;
});
