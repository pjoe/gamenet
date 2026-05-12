# Release Steps

1. Check existing tags so you can pick the next release version.

   ```bash
   git tag -l
   ```

2. Bump the monorepo version across all workspace packages.

   ```bash
   node scripts/bump-version.mjs 0.0.8
   ```

3. Review the updated package files, then commit the version change.

   ```bash
   git status
   git add .
   git commit -m "chore: release v0.0.8"
   ```

4. Create the release tag.

   ```bash
   git tag v0.0.8
   ```

5. Push the commit and the new tag to `origin`.

   ```bash
   git push origin main v0.0.8
   ```

Replace `0.0.8` with the version you are releasing.
