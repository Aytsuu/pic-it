# Gotchas

Failure modes that look like structure or performance work until they are not.

## Routing

- **Every file in `src/app` is a route** (except `_layout` and `+` specials). A `helpers.ts` next to `index.tsx` becomes `/helpers`.
- **`src/app` beats root `app/`.** If both exist, the root `app/` is ignored.
- **Custom `expo-router` `root` (e.g. `src/routes`)** is unsupported. Tools assume `app` or `src/app`.
- **API vs screen collision.** `user.tsx` and `user+api.ts` fight over `/user`. Put APIs under `src/app/api/`.
- **Reserved paths** such as `/assets` cannot be routes.
- **Route groups do not create URLs.** `(tabs)/settings.tsx` is `/settings`, not `/tabs/settings`. Deep links must match the URL, not the folder name.
- **Do not put providers only on one tab file.** Root `_layout.tsx` owns fonts, theme, query client, splash.

## Imports and bundling

- **Barrels + CJS = no tree-shaking.** One `module.exports` in the re-export chain can cancel shaking for the subgraph.
- **Feature `index.ts` barrels break Fast Refresh** (Obytes). Import `@/features/auth/login-screen`, not `@/features/auth`.
- **Re-exported `Platform.OS` is not shaken.** Import `Platform` from `react-native` in the file that branches.
- **`process.env['EXPO_PUBLIC_X']` and destructuring are not inlined.** ESLint from `npx expo lint` flags this; the value will be `undefined` at runtime.
- **`require()` of JS** disables ESM graph optimizations. Assets are the exception.

## Performance false friends

- **Infinite re-renders look like “the list is slow.”** Highlight updates before swapping FlatList.
- **Manual `useMemo` everywhere** fights React Compiler and hides missing dependencies. Enable the compiler first.
- **`PanResponder` on native** does JS-thread gestures. Use Gesture Handler.
- **FlashList v1 `estimatedItemSize`** is gone in v2; v2 needs New Architecture. Expo SDK 55 cannot disable New Architecture.
- **Blocking the JS thread** (tight loops, huge JSON parse on press) freezes React work; native scroll may still move, which looks like “random” lag on navigation.

## Security and env

- **`EXPO_PUBLIC_` is public.** Anything in the client bundle is extractable. Auth secrets belong on `+api` / EAS Secrets / SecureStore.
- **`NODE_ENV` is not an env-file switch.** Export and EAS Update force production. Use `eas env:pull` or replace `.env.local`.
- **Server-only modules imported by a screen** can leak patterns and, if mis-bundled, secrets. Keep `src/server` off the client graph.

## Structure mix-ups

- **Ignite `app/navigators` + Expo Router `src/app`** in one product is two routers. Pick one.
- **PascalCase vs kebab-case** mixed in one tree. SDK 55 default is kebab-case.
- **Styles in a sibling `*.styles.ts` by habit** — Expo now colocate at the bottom of the component.
- **Tests only under `__tests__/`** while new files colocate — reviewers will miss coverage. Pick one; this pack colocates unit tests.
- **Promoting every widget to `components/ui`** recreates a junk drawer. Promote at two features, no domain names.

## Compiler and upgrades

- React Compiler skips `node_modules`. Slow third-party components stay slow unless you patch, fork, or replace.
- `"use no memo"` disables the compiler for that unit — treat it as a bug marker, not a style.
- Health check (`npx react-compiler-healthcheck@latest`) before turning the experiment on; dirty hook violations become silent perf cliffs.
