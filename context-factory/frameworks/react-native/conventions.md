# Conventions

Hard defaults for new Expo Router apps. Deviate only when the repo already standardized something else (and document it).

## TypeScript

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- No `any` without a one-line justification.
- `@ts-expect-error` over `@ts-ignore`.
- Restart the bundler after path-alias changes.

## JavaScript dialect

- ESM only in `src/`.
- `const` by default, `let` when reassigned, never `var`.
- Named exports except Expo Router route `export default`.
- kebab-case filenames (SDK 55 template).

## Linting and compiler

```sh
npx expo lint
npx react-compiler-healthcheck@latest
```

```json
{
  "expo": {
    "experiments": {
      "reactCompiler": true
    }
  }
}
```

React Compiler: SDK 54+, New Architecture on (SDK 55: New Architecture cannot be turned off).

Keep `react-native-reanimated/plugin` as the **last** Babel plugin when Reanimated is installed.

## Environment variables

Client bundle **only** inlines `EXPO_PUBLIC_*` via static `process.env.EXPO_PUBLIC_NAME` (dot access). These values are **visible in the binary**.

```ts
// PASS
const url = process.env.EXPO_PUBLIC_API_URL;

// FAIL — not inlined
const url = process.env['EXPO_PUBLIC_API_URL'];
const { EXPO_PUBLIC_API_URL } = process.env;
```

| Variable | Where |
|----------|--------|
| `EXPO_PUBLIC_*` | Public config (API base URL, feature flags) |
| Unprefixed secrets | EAS Secrets, CI env, `src/server` / `+api` only |
| `.env.local` | gitignored machine overrides |
| EAS environments | `eas env:pull` into `.env.local` — do not overload `NODE_ENV` to pick env files |

`npx expo export` and `eas update` force `NODE_ENV=production`. Do not use `NODE_ENV=test npx expo export` expecting `.env.test`.

Library authors must not read `EXPO_PUBLIC_*` inside published packages (inlining is app-only).

## Secrets and storage

- Tokens, session cookies, private API keys: `expo-secure-store` or an equivalent encrypted store — **not** AsyncStorage, **not** `EXPO_PUBLIC_`.
- Obytes uses MMKV for fast client storage; still do not put refresh tokens in public env.
- Never log tokens, auth headers, or PII.

## New Architecture and Hermes

Assume both on. Do not add `newArchEnabled: false`. FlashList v2 and React Compiler require the New Architecture.

## Path and folder invariants

- Application code: `src/`.
- Router root: `src/app` only (not `src/routes`).
- Config files stay at repo root.
- `@/` maps to `src/`.
- Direct imports; no app-level barrels.

## Native folders

Do not edit `ios/` or `android/` as the source of truth. Use Expo config plugins and CNG (`npx expo prebuild`). Ignite and Obytes both treat generated native projects as output.

## Commits and reviews (this pack)

A change is incomplete if it:

- Adds a non-route file under `src/app`.
- Introduces a barrel `index.ts` for convenience.
- Stores a secret in `EXPO_PUBLIC_*`.
- Adds `useMemo`/`useCallback` without a measured reason while the compiler is on.
- Imports `@/server` from a screen.
