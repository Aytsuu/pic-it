# React Native (Expo) — Framework Context

Agent-ready guidance for Expo + React Native apps. Use this pack when scaffolding, reviewing, or expanding a native or universal Expo project.

**Stack this pack assumes:** Expo SDK 54+ (SDK 55 folder defaults), Expo Router, TypeScript strict, New Architecture on, React 19.

| Load this file | When |
|----------------|------|
| [architecture.md](./architecture.md) | Layers, dependency direction, navigation, state, server boundaries |
| [folder-structure.md](./folder-structure.md) | Canonical trees for small vs large apps, route notation |
| [code-organization.md](./code-organization.md) | Thin routes, naming, imports, platform files, tests, styles |
| [performance.md](./performance.md) | JS-thread lag, React Compiler, lists, worklets, native modules |
| [conventions.md](./conventions.md) | TypeScript, env vars, secrets, ESLint, compiler, aliases |
| [gotchas.md](./gotchas.md) | Failure modes that look like “best practice” |
| [sources.md](./sources.md) | Citations and confidence notes |

## Defaults this pack encodes

1. **`src/` is required.** Application code lives under `src/`. Config, assets, scripts, and `public/` stay at the project root. SDK 55+ templates already do this.
2. **`src/app` is routes only.** Every file there is a route, layout, or API route. Screen UI, hooks, and helpers live elsewhere.
3. **Thin route files.** A route reads params / guards and renders a screen (or re-exports one). It does not own large UI trees.
4. **kebab-case filenames.** Matches the Expo SDK 55 default template (updated 7 Jan 2026).
5. **No barrel `index.ts` re-export barrels** for app modules. Direct file imports. Expo tree-shaking and Fast Refresh both fail more often with barrels.
6. **Colocate styles and unit tests** with the file they belong to. Do not split `button.styles.ts` or a top-level `__tests__/` for unit tests.
7. **Server code is isolated.** API routes live in `src/app/api/`. Shared server helpers live in `src/server/` and are never imported from client screens.
8. **Enable React Compiler** after TypeScript strict + ESLint (rules of React) + ESM are in place.
9. **Graduate to `features/`** when `screens/` and `components/` become a dumping ground. Do not start every new app with a full feature-sliced tree.

## Size heuristic

| App size | Structure |
|----------|-----------|
| Small / tutorial | `src/app` + `src/components` + `src/hooks` + `src/utils` |
| Product (this pack’s default) | Add `src/screens` and, if using API routes, `src/app/api` + `src/server` |
| Multi-team / many domains | Add `src/features/<domain>` and keep routes as one-line re-exports |

## Out of scope

- Bare React Native without Expo (different native-folder and Metro story).
- Ignite’s default React Navigation tree — documented as an alternative in [architecture.md](./architecture.md), not the Expo default.
- Backend-for-frontend design beyond Expo Router API routes / EAS Hosting.
