import fs from "fs";
import path from "path";

const version = process.argv[2];
const roots = ["packages", "apps"];

// Collect metadata about all workspace packages
const workspace = new Map();

for (const root of roots) {
  if (!fs.existsSync(root)) continue;

  for (const name of fs.readdirSync(root)) {
    const pkgPath = path.join(root, name, "package.json");
    if (!fs.existsSync(pkgPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    workspace.set(pkg.name, {
      path: pkgPath,
      private: pkg.private === true,
    });
  }
}

// Update each package
for (const [pkgName, meta] of workspace.entries()) {
  const pkg = JSON.parse(fs.readFileSync(meta.path, "utf8"));

  // Always bump version, even for private packages
  pkg.version = version;

  // Update internal deps
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    if (!pkg[field]) continue;

    for (const dep in pkg[field]) {
      if (!workspace.has(dep)) continue; // not a workspace dep

      const depMeta = workspace.get(dep);
      const current = pkg[field][dep];

      // Preserve workspace:* or workspace:^ for private packages
      if (current.startsWith("workspace:")) {
        continue;
      }

      // Otherwise bump to the new version
      pkg[field][dep] = version;
    }
  }

  fs.writeFileSync(meta.path, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Updated", meta.path);
}
