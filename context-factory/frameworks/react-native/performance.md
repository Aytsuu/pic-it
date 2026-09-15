# Performance

Expo already splits work: JavaScript runs on its own thread; draw calls are flattened onto the UI thread; most native modules keep work off JS. **Lag in Expo apps is usually the JS thread blocking** (re-renders, lists, JS-driven gestures), not “the main thread is doing business logic.”

Scrolling and gestures can still move while JS is catching up — which hides the jam until a React-driven animation or a stack push stutters.

Apply the steps **in order**. Do not jump to worklets or a new list library while TypeScript, ESM, ESLint, and React Compiler are off.

## Diagnose first

1. Press **J** in Expo CLI → Chrome DevTools attached to Hermes.
2. Profiler → gear → **Highlight updates when components render**.
3. Reproduce the stutter. Solid boxes mean infinite re-render; flashes show extra updates.

This is the in-app equivalent of React Scan. Fix the hot component before rewriting architecture.

## Step 1 — TypeScript

- `npx expo customize tsconfig.json` or rename a file to `.ts` / `.tsx`.
- `compilerOptions.strict: true`.
- Avoid `any`. Prefer `// @ts-expect-error` over `// @ts-ignore`.

Strict typing catches mutations and hoist bugs that make React skip memoization later.

## Step 2 — Static JavaScript (ESM)

| Do | Do not |
|----|--------|
| `const` / `let` | `var` (hoisting) |
| `import` / `export` | `require` / `module.exports` for JS |
| Direct file imports | Barrel `index.ts` re-export files |
| `require('./img.png')` for assets | Mixing CJS into ESM graphs |

If Metro finds CJS in a module, tree-shaking for that subgraph is cancelled. Expo can collapse barrels experimentally, but the pass is slower and fails if any re-export is CJS.

Production-only removal:

```ts
if (__DEV__) {
  // stripped in production
}

if (process.env.NODE_ENV === 'development') {
  // stripped in production
}
```

Import `Platform` from `react-native` in the file that branches so unused platform code is shaken.

## Step 3 — ESLint (rules of React)

```sh
npx expo lint
```

React is not “reactive JavaScript.” The ESLint plugin is what makes later compiler memoization **safe**. It also flags destructuring `process.env`, which Expo cannot inline.

## Step 4 — React Compiler

Beta in the original Expo post; **stable from Expo SDK 54**, requires New Architecture (default in 54+, mandatory in SDK 55).

Health check, then enable:

```sh
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

The compiler auto-memoizes values, callbacks, and JSX so parents do not update pure children. You do not write `useMemo`, `useCallback`, or `React.memo` as a habit.

Notes:

- Runs on **app source**, not `node_modules`.
- Escape hatch: `"use no memo"` in a component or at the top of a file.
- This is the highest-leverage Expo performance default as of 2025–2026.

## Step 5 — React 19 `use`

Replace `useContext` with `use(Context)` so reads can sit **after** a return/conditional. Fewer wrapper components, fewer unused hook calls.

## Step 6 — Lists (almost every RN screen)

There is no universal list. Match the pain:

| Symptom | Direction |
|---------|-----------|
| Blank cells / jank on long feeds | Shopify [FlashList v2](https://github.com/Shopify/flash-list) (New Architecture only; no `estimatedItemSize`) |
| Tiny static lists | `FlatList` is enough |
| Wrong data while recycling | FlashList `useRecyclingState` |
| Fetching too much | Pagination / query policy, not a new list |
| Nested heavy lists | Flatten; one scrolling axis; `getItemType` pools |

Expo’s lag article: New Architecture already recycles native views; a list built for that (FlashList v2) is the practical default for large/complex rows. Keep `renderItem` and `keyExtractor` stable; avoid inline objects that defeat recycling.

## Step 7 — Multi-thread JS (pro)

When the JS thread is still the limit after the steps above:

| Tool | Use |
|------|-----|
| Reanimated worklets | Gesture-driven layout that must run on the UI thread |
| react-native-gesture-handler | Native gestures; **never** `PanResponder` on native |
| Vision Camera worklets | Frame processors |
| API routes / server functions | Heavy or secret work off-device |
| Standalone worklets RFC | Watch Software Mansion; today worklets ship via Reanimated |

Worklets compile a `'worklet'` function to run off the React JS thread with shared values. Expo Go includes Reanimated; keep `react-native-reanimated/plugin` last in Babel.

## Native instead of JS

- Prefer platform modules over large JS polyfills.
- For hot cache/query paths, `expo-sqlite` (or a file-system module you control) beats a generic JS cache.
- Animations: Reanimated, not the legacy `Animated` API, for anything gesture-coupled (Meta still uses `Animated` internally; Expo’s advice for product apps is Reanimated).

## What not to do first

- Manual memoization everywhere (Compiler does this).
- Custom router root or extra native list view “because lists are slow” before highlighting re-renders.
- Putting business work on the UI thread “to make it faster” — Expo already keeps JS off the UI thread; blocking JS is the usual bug.
