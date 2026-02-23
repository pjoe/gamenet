import { resolve } from "node:path";

export function createWorkspaceAliases(fromDir: string) {
  return [
    {
      find: "@gamenet/core/react",
      replacement: resolve(
        fromDir,
        "../../packages/gamenet/src/react/GameContext.tsx"
      ),
    },
    {
      find: "@gamenet/core/worker-setup",
      replacement: resolve(
        fromDir,
        "../../packages/gamenet/src/routing/host_server_worker_setup.ts"
      ),
    },
    {
      find: /^@gamenet\/core$/,
      replacement: resolve(fromDir, "../../packages/gamenet/src/index.ts"),
    },
    {
      find: "@gamenet/example-ui/styles",
      replacement: resolve(fromDir, "../../packages/example-ui/src/index.css"),
    },
    {
      find: /^@gamenet\/example-ui$/,
      replacement: resolve(fromDir, "../../packages/example-ui/src/index.ts"),
    },
  ];
}
