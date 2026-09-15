# Architecture

Expo apps scale when routing, UI composition, shared primitives, and server code have **one-way dependencies**. File-based routing does not replace that graph — it only maps URLs to entry files.

## Layer graph

```text
src/app            routing, layouts, API routes
        ↓
src/screens        OR  src/features/<domain>
        ↓
src/components     shared UI (used in 2+ screens/features)
src/hooks          shared hooks
        ↓
src/utils          src/lib (at scale)     src/theme
        ↓
src/server         used only by +api files / EAS Hosting
```

**Allowed:** a route imports a screen; a screen imports a component or hook; a feature imports `@/components/ui` and `@/lib`.

**Forbidden:**

- A util, hook, or component importing a screen or a route file.
- Client screens importing `src/server/*`.
- Feature A importing Feature B’s private `components/` (import a named public module, or promote the shared piece).
- Putting non-route files inside `src/app` (they become URLs).

## Navigation is Expo Router

Expo Router is file-based React Navigation. The navigation tree is the `src/app` folder plus `_layout.tsx` files.

| Concern | Where it lives |
|---------|----------------|
| URL / deep link | File path under `src/app` |
| Stack vs tabs vs slots | `_layout.tsx` in that directory |
| Auth gates, splash, fonts, theme providers | Root `src/app/_layout.tsx` |
| Screen UI | `src/screens` or `src/features/<domain>` |
| Shared chrome (tab bar, text field) | `src/components` — **not** in `src/app` |

Root `_layout.tsx` is the old `App.tsx`: load fonts, wrap providers, control the splash screen, then render the navigator (`<Stack />`, `<Tabs />`, or Expo’s native tabs).

Route groups `(auth)`, `(app)`, `(tabs)` wrap navigators **without changing the URL**. Use them for auth vs signed-in trees, not as a substitute for `features/`.

Dynamic segments (`[id].tsx`) belong in `src/app`. The screen they render reads `useLocalSearchParams` in the **route** (or a tiny wrapper) and passes typed props into the screen.

### Alternative: Ignite / React Navigation

[Infinite Red Ignite](https://github.com/infinitered/ignite) (Expo SDK 55, React Navigation v7) keeps `app/navigators`, `app/screens`, `app/services`, `app/theme`. It is evaluating Expo Router and ships an experimental switch. **Do not mix** a handwritten `NavigationContainer` with Expo Router in the same app unless a migration is explicit.

## State

Keep state next to the code that owns it. Do not start with a global store.

| Kind | Default |
|------|---------|
| Server/async data | TanStack Query (or equivalent) in a feature `api.ts` or shared `src/lib/api` |
| Ephemeral UI | Local `useState` / React Compiler auto-memo |
| Cross-screen client session | Auth context or a small Zustand store (`use-auth-store.tsx`) |
| Theme / i18n / first-run | Root providers in `_layout.tsx`, implementations in `src/lib` or `src/hooks` |
| Secrets (tokens) | Secure storage API, never `EXPO_PUBLIC_*` or AsyncStorage for tokens |

React 19: prefer `use(Context)` over `useContext` so context can be read **after** a conditional (for example skip theme when unauthenticated).

React Compiler (SDK 54+, New Architecture) is the memoization layer. Do not sprinkle `useMemo` / `useCallback` / `React.memo` unless the compiler is off or a profiler proves a gap.

## Server vs client

Expo Router `+api` files run in a Node-like environment (EAS Hosting). Client bundles only inline `EXPO_PUBLIC_*` vars. API routes can read any `process.env` secret.

```text
src/app/api/user+api.ts     →  GET/POST /api/user
src/server/db.ts            →  imported only from +api / server helpers
```

Group all API routes under `src/app/api/` to avoid colliding with a screen named `user.tsx`. Apply different ESLint environments: `+api` and `src/server` are Node; the rest is React Native / web.

Move work off the JS thread **or** off-device:

1. Native modules / SQLite / Gesture Handler for on-device hot paths.
2. API routes and React Server Functions for heavy or secret work.
3. Reanimated worklets when the UI thread must run JS during a gesture.

## Two supported shapes

### A. Expo official (default until domains proliferate)

Routes in `src/app`, screen bodies in `src/screens`, shared UI in `src/components`. This matches Expo’s folder-structure article and the official `expo-project-structure` skill.

Use this for new apps and anything a single team can hold in their head.

### B. Feature modules (Obytes / bulletproof-react)

When `screens/` grows mixed domains, introduce `src/features/<name>/`:

- `*-screen.tsx` at the feature root
- `components/` for private UI
- `api.ts` for that domain’s queries
- `use-*-store.tsx` for that domain’s client state

Routes become:

```ts
export { LoginScreen as default } from '@/features/auth/login-screen';
```

Obytes additionally uses `src/components/ui` (design system) and `src/lib` (API client, i18n, storage). Promote a component into `ui/` only when **two or more features** need it and it has no domain logic.

Both shapes keep the same rule: **`src/app` does not own UI trees.**

## Platform split

Small differences: `Platform.OS` / `Platform.select` imported **directly** from `react-native` (required for Metro platform shaking).

Large differences (different libraries, different trees): platform files.

```text
bar-chart.tsx          default (required)
bar-chart.web.tsx
bar-chart.native.tsx
bar-chart.ios.tsx
bar-chart.android.tsx
```

Import as `@/components/bar-chart`. Props must match across variants. A default file is always required; a no-op default is valid if the component is web-only.

## Testing the graph

- Unit tests sit next to the unit (`format-date.test.ts`).
- Route files stay thin enough that most tests target screens, hooks, and utils — not the router file.
- E2E (Maestro or equivalent) lives at the repo root (`.maestro/`), not under `src/app`.
