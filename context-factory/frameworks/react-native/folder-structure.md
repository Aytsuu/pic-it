# Folder structure

## Project root vs `src/`

Keep tooling and native-adjacent config at the **repository root**. Keep application TypeScript under `src/`.

SDK 55+ `create-expo-app` already generates `src/app`, `src/components`, `src/constants`, and `src/hooks`. No extra Expo Router config is required.

```text
├── assets/                 # images, fonts (Metro + app.json)
├── public/                 # web static files (stay at root)
├── scripts/                # node scripts, not bundled
├── src/                    # all app TS/TSX
├── app.json | app.config.ts
├── eas.json
├── package.json
├── tsconfig.json
├── metro.config.js
└── .env / .env.local       # never commit secrets; see conventions.md
```

Rules from Expo Router:

- `src/app` **wins** if both `app/` and `src/app` exist.
- Do not move `app.json`, `metro.config.js`, or `public/` into `src/`.
- Do not rename the router root to `src/routes` (or anything else). Expo will not accept bugs for custom router roots.

Path alias after the move:

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

Restart Expo CLI after changing `tsconfig.json` paths.

## Default tree (product apps)

This is the structure Expo documents when you combine `src/`, thin routes, screens, colocated tests, platform files, and API routes.

```text
src/
├── app/                          # ROUTES ONLY
│   ├── (app)/                    # signed-in group (URL-invisible)
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # → screens/home
│   │   ├── events.tsx
│   │   └── settings.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   ├── api/                      # all +api routes, avoids /user collisions
│   │   ├── user+api.ts
│   │   └── event+api.ts
│   ├── _layout.tsx               # providers, splash, fonts
│   ├── _layout.web.tsx           # optional web shell
│   └── +not-found.tsx
├── screens/
│   ├── home/
│   │   ├── index.tsx             # Home screen body
│   │   └── timeline.tsx          # used only here
│   ├── events.tsx
│   └── settings.tsx
├── components/
│   ├── button.tsx
│   ├── table/
│   │   ├── index.tsx             # public Table
│   │   ├── row.tsx
│   │   └── cell.tsx
│   ├── bar-chart.tsx
│   └── bar-chart.web.tsx
├── hooks/
│   ├── use-app-state.ts
│   └── use-theme.ts
├── utils/
│   ├── format-date.ts
│   ├── format-date.test.ts
│   └── pluralize.ts
├── server/                       # Node-only helpers for +api
│   ├── auth.ts
│   └── db.ts
├── constants.ts
└── theme.ts
```

### What each folder is for

| Path | Owns | Does not own |
|------|------|----------------|
| `src/app` | File-based routes, layouts, `+api`, `+not-found` | Reusable UI, hooks, formatters |
| `src/screens` | Page-level composition and page-private widgets | Design-system primitives |
| `src/components` | Reusable UI with one named export | Feature-only widgets (those stay under the screen/feature) |
| `src/hooks` | Hooks used in 2+ screens | One-screen hooks (colocate with that screen) |
| `src/utils` | Pure helpers (dates, money, strings) | React components, I/O, stores |
| `src/server` | DB, auth, secrets for API routes | Anything imported by screens |
| `assets/` | Binary assets referenced by `require` / `expo-asset` | TS modules |

## Large-app tree (feature modules)

Add this when multiple product domains would otherwise dump files into `screens/` and `components/`. Pattern used by [Obytes Expo starter](https://starter.obytes.com/getting-started/project-structure/) and aligned with [bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md).

```text
src/
├── app/                          # still routes only (thin re-exports)
│   ├── (app)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # export { FeedScreen as default } from '@/features/feed/feed-screen'
│   │   ├── settings.tsx
│   │   └── feed/
│   │       ├── [id].tsx
│   │       └── add-post.tsx
│   ├── login.tsx
│   └── onboarding.tsx
├── features/
│   ├── auth/
│   │   ├── login-screen.tsx
│   │   ├── use-auth-store.tsx
│   │   └── components/
│   │       ├── login-form.tsx
│   │       └── login-form.test.tsx
│   ├── feed/
│   │   ├── feed-screen.tsx
│   │   ├── post-detail-screen.tsx
│   │   ├── add-post-screen.tsx
│   │   ├── api.ts
│   │   └── components/
│   │       └── post-card.tsx
│   └── settings/
│       ├── settings-screen.tsx
│       └── components/
│           └── language-item.tsx
├── components/
│   └── ui/                       # design system (2+ features, no domain logic)
│       ├── button.tsx
│       ├── input.tsx
│       └── text.tsx
├── lib/                          # infrastructure features depend on but do not own
│   ├── api/
│   ├── auth/
│   ├── hooks/
│   ├── i18n/
│   └── storage.ts
└── translations/
    ├── en.json
    └── …
```

Feature folder rules (Obytes):

- Screens: `*-screen.tsx` at the feature root.
- Only `components/` as a nested folder (avoid `hooks/`, `api/`, `types/` folders inside a feature).
- API: one `api.ts`, not an `api/` directory.
- State: `use-*-store.tsx`.
- **No** `index.ts` barrel at the feature root (Fast Refresh).

## Route notation cheat sheet

All of this applies **inside `src/app` only**.

| File | URL / role |
|------|------------|
| `about.tsx` | Static `/about` |
| `feed/favorites.tsx` | Static `/feed/favorites` |
| `users/[userId].tsx` | Dynamic `/users/123` |
| `(home)/settings.tsx` | `/settings` (group omitted from URL) |
| `(home)/index.tsx` | `/` if this is the first index |
| `_layout.tsx` | Navigator / providers; not a page |
| `+not-found.tsx` | Unmatched routes |
| `+html.tsx` | Web HTML shell |
| `+native-intent.ts` | Unmatched native deep links |
| `+middleware.ts` | Runs before a route (auth, redirects) |
| `user+api.ts` | API route (Node). Prefer `api/user+api.ts` → `/api/user` |

Reserved Metro/Router paths such as `/assets` must not be used as routes.

## Ignite tree (do not mix)

Ignite’s default is type-organized under `app/` with React Navigation, not Expo Router:

`app/components`, `app/screens`, `app/navigators`, `app/services`, `app/theme`, `app/i18n`, `app.tsx`.

Use it only when the repo already chose Ignite. New Expo Router apps follow the trees above.
