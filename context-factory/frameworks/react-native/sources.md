# Sources

Synthesized 15 Sep 2026. Prefer these URLs when this pack disagrees with memory.

## Primary (requested)

1. [How to organize Expo app folder structure for clarity and scalability](https://expo.dev/blog/expo-app-folder-structure-best-practices) — Expo blog. `src/`, routes-only `app/`, components, screens, server isolation, platform files, colocate styles/tests. Changelog 7 Jan 2026: kebab-case default for SDK 55.
2. [Best practices for reducing lag in Expo apps](https://expo.dev/blog/best-practices-for-reducing-lag-in-expo-apps) — Expo blog. JS-thread model, TypeScript → ESM → ESLint → React Compiler → React 19 `use` → worklets, native modules, lists.

## Official Expo docs and skills

3. [Top-level src directory](https://docs.expo.dev/router/reference/src-directory/) — SDK 55 templates include `src/`; `src/app` precedence; do not customize router root.
4. [Expo Router core concepts](https://docs.expo.dev/router/basics/core-concepts/) — every file in `src/app` is a page; `_layout.tsx` replaces `App.jsx`.
5. [Expo Router notation](https://docs.expo.dev/router/basics/notation/) — groups, dynamic segments, `+` files.
6. [TypeScript in Expo](https://docs.expo.dev/guides/typescript/) — `@/*` → `src/*`.
7. [Environment variables](https://docs.expo.dev/guides/environment-variables/) — `EXPO_PUBLIC_` inlining rules, secrets warning, EAS/`NODE_ENV` behavior.
8. [Tree shaking](https://docs.expo.dev/guides/tree-shaking/) — ESM, barrels, `Platform` shaking, `__DEV__`.
9. [expo/skills — expo-project-structure](https://github.com/expo/skills/blob/main/plugins/expo/skills/expo-project-structure/SKILL.md) — canonical tree matching the folder-structure article.
10. [expo/skills — React Compiler](https://github.com/expo/skills) — stable SDK 54+, New Architecture, `experiments.reactCompiler`.

## Published repositories / starters

11. [Obytes React Native template](https://github.com/obytes/react-native-template-obytes) and [project structure docs](https://starter.obytes.com/getting-started/project-structure/) (updated 26 Jan 2026) — feature modules, thin route re-exports, no feature barrels, `components/ui` + `lib`.
12. [bulletproof-react project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — feature-oriented `src/features` used widely on web; Obytes adapts it to Expo.
13. [Infinite Red Ignite](https://github.com/infinitered/ignite) / [boilerplate layout](https://docs.infinite.red/ignite-cli/boilerplate/) — long-lived Expo app boilerplate; React Navigation v7 by default; Expo Router experimental. Type-folder `app/` — not the Expo Router default.
14. [Shopify FlashList](https://github.com/Shopify/flash-list) and [FlashList v2 engineering post](https://shopify.engineering/flashlist-v2) — New Architecture list recycling; no size estimates in v2.

## Confidence

| Topic | Confidence | Note |
|-------|------------|------|
| `src/app` + thin screens + kebab-case | High | Expo blog + SDK 55 docs + official skill |
| No barrels / ESM for Metro | High | Expo lag post + tree-shaking guide + Obytes Fast Refresh |
| React Compiler as default | High for SDK 54+ | Skills say stable; original blog still said beta — follow SDK 54+ docs |
| Feature folders (`src/features`) | High as *scale-up* | Community starter, not Expo’s first template |
| Ignite navigators | High as *alternative* | Different router; do not mix |
| FlashList v2 as default large list | Medium–high | Shopify production; still choose by list shape |
| Worklets without Reanimated | Low / future | RFC only at time of writing |

## Intentionally not copied

Full article text, template source files, and Ignite generator internals. This pack is a constraint set for agents, not a mirror of those repos.
