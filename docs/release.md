# Release

With a clean working tree on `main`, run:

```bash
pnpm run release
```

Without a version argument, the script suggests a patch bump from the highest
SemVer `v` tag found locally or on `origin` (compared numerically, not by tag date).
If no valid version tags exist, it uses the current `@gamenet/core` package
version. Prerelease and build suffixes are removed from the suggestion before
incrementing the patch, so `v0.0.8-rc.1` suggests `0.0.9`.

Confirm `Release v<version>? [y/N]` with `y` or `yes` to proceed. Any other answer,
including Enter or end-of-input, cancels without changing files, commits, or tags.

To specify a version and skip the confirmation prompt, run:

```bash
pnpm run release 0.0.8
```

Replace `0.0.8` with the SemVer version you are releasing (without the `v`
prefix). Prerelease versions such as `0.0.8-rc.1` are also supported. You can
check existing tags with `git tag -l` before choosing a version.

The script:

1. Validates the version, clean working tree, `main` branch, and absence of the
   release tag locally and on `origin`.
2. Fetches `origin/main` and checks that local `main` is not behind or diverged.
3. Runs the existing version bumper for all packages under `packages/` and
   `apps/`, preserving `workspace:` dependency references. The root private
   package version remains unchanged, as in the previous process.
4. Stages the workspace package manifests and commits them as
   `chore: release v0.0.8`.
5. Creates `v0.0.8` and atomically pushes `main` and the tag to `origin`.

Run the project's tests and builds before releasing; the script does not run
those checks or publish packages directly. Pushing the tag triggers the existing
release workflows. Any unpushed commits already on `main` are pushed as well.

The script stops on the first failure and does not discard local changes. If a
commit or tag step fails, inspect `git status` and `git tag -l` before recovering.
If the final push fails, the local release commit and tag remain; fix the push
failure and retry only the push:

```bash
git push --atomic origin main v0.0.8
```

Atomic pushing prevents a rejected push from updating only one of the branch or
tag; `origin` must support atomic pushes (GitHub does).
