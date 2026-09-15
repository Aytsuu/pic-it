# Code organization

## Routes stay thin

Every file under `src/app` is a route. Keep it as a param/guard adapter.

```tsx
// src/app/index.tsx
import { Home } from '@/screens/home';

export default function HomeRoute() {
  // URL params, auth redirects, analytics — not UI trees
  return <Home />;
}
```

Large-app variant (Obytes):

```tsx
// src/app/login.tsx
export { LoginScreen as default } from '@/features/auth/login-screen';
```

Benefits: the same screen can mount on more than one route without Expo shared-routes ceremony; route files stay searchable; Fast Refresh stays on the screen module.

Do **not** add helper components next to a route file. They become routes. Put them in that screen’s folder or the feature’s `components/`.

## Filenames

**Default: kebab-case**, matching Expo SDK 55 templates (changelog 7 Jan 2026).

| Kind | File | Export |
|------|------|--------|
| Component | `icon-button.tsx` | `export function IconButton` |
| Hook | `use-app-state.ts` | `export function useAppState` |
| Util | `format-date.ts` | `export function formatDate` |
| Screen (official) | `screens/home/index.tsx` | `export function Home` |
| Screen (features) | `feed-screen.tsx` | `export function FeedScreen` |
| Test | `format-date.test.ts` | colocated |
| Platform | `bar-chart.web.tsx` | same public props as default |

Classic `PascalCase.tsx` matching the component name is valid **if the whole repo already uses it**. Do not mix.

Each reusable module has **one named export**. Default exports are reserved for Expo Router route files.

## Components

Simple: one file, one function.

```tsx
export function Button(/* … */) {
  return /* … */;
}

const styles = StyleSheet.create({
  /* styles at the bottom of the same file */
});
```

Complex: folder + `index.tsx` so the import path does not change when you split files.

```text
components/table/
  index.tsx     # export function Table
  row.tsx       # private
  cell.tsx      # private
```

`index.tsx` here is the **component root**, not a barrel that re-exports unrelated modules.

Promote into `src/components` (or `components/ui`) only when a second screen/feature needs the piece **and** it has no domain wording. Otherwise keep it next to the screen.

## Imports

Use `@/` for anything outside the current folder. Use relative imports **inside** a feature or a component folder.

```ts
// PASS
import { Button } from '@/components/button';
import { formatDate } from '@/utils/format-date';
import { LoginForm } from './components/login-form';

// FAIL — barrels
import { LoginScreen } from '@/features/auth';
import * as UI from '@/components';
```

Why barrels are banned in app code:

1. Expo tree-shaking can collapse them, but any CJS in the chain **cancels** the optimization for that subgraph.
2. Fast Refresh often reloads the whole barrel (Obytes: “no `index.ts` barrel exports”).
3. Metro graph analysis is slower and easier to get wrong.

`require('./icon.png')` for assets is fine — assets are not tree-shaken like JS.

Use ESM `import` / `export` everywhere else. `var` and `module.exports` are not allowed in `src/`.

## Platform files

Import without the platform suffix:

```ts
import { BarChart } from '@/components/bar-chart';
```

Metro picks `.web`, `.native`, `.ios`, or `.android`. Contract:

- Identical props on every variant.
- A suffix-less default file always exists (no-op is allowed).
- Prefer platform files once `Platform.select` would duplicate trees or pull different libraries.

For shaking, import `Platform` from `react-native` in the **same file** that branches. Re-exporting `Platform.OS` from a helper disables platform shaking.

## Styles

Keep `StyleSheet.create` (or NativeWind classNames) **in the component file**, typically below the component. Split `button.styles.ts` only if the file is already at the size limit and styles are the bulk — not as a default.

Theme tokens live in `src/theme.ts` or `src/components/ui` — not copied per screen.

## Tests

Colocate unit tests: `format-date.ts` + `format-date.test.ts`.

A repo-wide `__tests__/` is acceptable only if already established. New Expo apps colocate.

Keep Maestro / Detox / Playwright at the repo root (`.maestro/`, `e2e/`), not inside `src/app`.

## Server modules

```ts
// PASS — from src/app/api/user+api.ts
import { getUser } from '@/server/db';

// FAIL — from a screen or hook
import { getUser } from '@/server/db';
```

If a type is needed on both sides, put a **types-only** module in `src/types` or next to the feature, not inside `src/server`.

## Adding a screen (checklist)

1. Create `src/screens/<name>/index.tsx` or `src/features/<domain>/<name>-screen.tsx`.
2. Create the route under `src/app` that renders or re-exports it.
3. Put page-private widgets beside the screen, not in `src/app`.
4. Import shared UI from `@/components`.
5. Add `*.test.ts` next to new utils/hooks.
6. Do not add an `index.ts` barrel to make imports “prettier.”
