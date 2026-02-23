---
description: "Use when editing React UI files in pages/components/theme context. Covers routing boundaries, Tailwind/theme usage, and UI-focused change scope."
name: "Frontend UI Guidelines"
applyTo: "src/main.tsx, src/App.tsx, src/index.css, src/pages/**, src/components/**, src/contexts/**"
---

# Frontend UI Guidelines

- Keep UI concerns in `src/pages/*`, `src/components/*`, and theme/state context in `src/contexts/*`.
- Preserve router and shell boundaries: global app wiring belongs in `src/main.tsx` and `src/App.tsx`.
- Use existing Tailwind utility patterns and theme tokens from `src/index.css`; avoid introducing new design systems.
- Keep changes minimal and local to the requested page/component unless explicitly asked to refactor across views.
- Prefer typed React code and avoid weakening TypeScript types for convenience.
- Follow existing lint/format behavior (`pnpm run lint`, `pnpm run format`).
