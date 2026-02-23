---
description: "Use when editing React UI files in pages/components/theme context. Covers routing boundaries, Tailwind/theme usage, and UI-focused change scope."
name: "Frontend UI Guidelines"
applyTo: "apps/example/src/main.tsx, apps/example/src/App.tsx, apps/example/src/index.css, apps/example/src/pages/**, apps/example/src/components/**, apps/example/src/contexts/**"
---

# Frontend UI Guidelines

- Keep UI concerns in `apps/example/src/pages/*`, `apps/example/src/components/*`, and theme/state context in `apps/example/src/contexts/*`.
- Preserve router and shell boundaries: global app wiring belongs in `apps/example/src/main.tsx` and `apps/example/src/App.tsx`.
- Reusable React bindings (GameContext, useGame) live in `packages/gamenet/src/react/` and are imported from `@gamenet/core/react`.
- Use existing Tailwind utility patterns and theme tokens from `apps/example/src/index.css`; avoid introducing new design systems.
- Keep changes minimal and local to the requested page/component unless explicitly asked to refactor across views.
- Prefer typed React code and avoid weakening TypeScript types for convenience.
- Follow existing lint/format behavior (`pnpm run lint`, `pnpm run format`).
