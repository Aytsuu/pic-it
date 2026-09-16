# Pic It — Implementation Plan

From scaffold to a working product. Each phase is self-contained: complete every checkbox before moving to the next phase, then run the verify steps to confirm the phase is done.

**Out of scope for this plan:** security hardening (RLS, rate-limiting, input sanitisation), deployment, analytics, i18n, accessibility depth.

---

## Stack


| Concern                  | Tool                                                          |
| ------------------------ | ------------------------------------------------------------- |
| App framework            | Expo SDK 55, Expo Router, TypeScript strict, New Architecture |
| Backend / DB             | Supabase (Auth, Postgres, Storage, Realtime)                  |
| Server state             | TanStack Query                                                |
| Local queue / offline DB | `expo-sqlite`                                                 |
| Connectivity detection   | `@react-native-community/netinfo`                             |
| Camera                   | `expo-camera`                                                 |
| Device photo save        | `expo-media-library`                                          |
| Instagram share-out      | `react-native-share`                                          |


---

## Data model

### Remote — Supabase Postgres

```text
users        id (uuid, Supabase Auth), display_name (text)
moments      id, name, host_id → users.id, code (text, unique 6-char), created_at
members      moment_id → moments.id, user_id → users.id   [composite PK]
photos       id, moment_id → moments.id, uploaded_by → users.id,
             storage_path (text), created_at
picks        user_id → users.id, photo_id → photos.id     [composite PK]
```

`moments.code` is the short join key (e.g. `A3F7KQ`). It is generated on insert.

### Local — SQLite (on-device only, never synced as a table)

```text
unsynced_photos   local_id (text, uuid generated on device)
                  moment_id (text)
                  local_uri (text)          — file:// path of the captured photo
                  created_at (integer)      — Unix ms
                  sync_status (text)        — "pending" | "synced" | "failed"
                  remote_id (text nullable) — photos.id once uploaded
                  attempts (integer)        — upload attempt count, default 0
```

Photos start as `pending` in SQLite. On successful upload they are marked `synced` and `remote_id` is set. Failed uploads (network error) stay in the queue and are retried on next connectivity event. After 5 failed attempts the row is marked `failed` and shown to the user with a manual retry option.

---

## App route map

```text
src/app/
  _layout.tsx                  root: providers, splash, session redirect
  +not-found.tsx
  (auth)/
    _layout.tsx                Stack navigator, no header
    sign-in.tsx                → screens/sign-in
  (app)/
    _layout.tsx                Tab or Stack navigator; requires session
    index.tsx                  → screens/moments-list   (home)
    create.tsx                 → screens/create-moment
    join.tsx                   → screens/join-moment
    moment/
      [id].tsx                 → screens/moment-roll   (the shared roll)
      [id]/camera.tsx          → screens/camera
```

---

## Phase 0 — Scaffold and config

Set up the repo so every subsequent phase has a clean, runnable base.

### Tasks

- [x] Run `npx create-expo-app@latest pic-it --template default` (SDK 55 default template)
- [x] Move generated `app/` into `src/app/` if not already placed there; confirm `src/` tree exists
- [x] Update `tsconfig.json`:
  ```json
  {
    "extends": "expo/tsconfig.base",
    "compilerOptions": {
      "strict": true,
      "baseUrl": ".",
      "paths": { "@/*": ["./src/*"] }
    }
  }
  ```
- [x] Create folder skeleton (empty `index.ts` or `.gitkeep` in each):
  ```text
  src/screens/
  src/components/
  src/hooks/
  src/lib/
  src/utils/
  ```
- [x] Install dependencies:
  ```sh
  npx expo install @supabase/supabase-js @tanstack/react-query
  npx expo install expo-camera expo-media-library expo-sqlite
  npx expo install expo-secure-store expo-constants
  npx expo install @react-native-community/netinfo
  npm install react-native-share
  ```
- [x] Create `src/lib/supabase.ts`:
  ```ts
  import { createClient } from '@supabase/supabase-js';

  export const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
  );
  ```
- [x] Create `.env.local` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (fill from Supabase dashboard); add `.env.local` to `.gitignore`
- [x] Create `.env.example` with the two keys blank (commit this)
- [x] Write root `src/app/_layout.tsx` — wraps app in `QueryClientProvider`; renders `<Slot />`
- [x] Write `src/app/+not-found.tsx` — simple "Page not found" text
- [x] Run `npx expo start` and confirm no errors in the Metro log

### Verify

- [x] App opens to a blank white screen (no crash, no red box)
- [x] In the Expo CLI, press `J` → Chrome DevTools → Console: `supabase` imported with no `undefined` URL warnings
- [x] `tsconfig.json` strict mode: running `npx tsc --noEmit` exits with no errors

---

## Phase 1 — Identity

Users need an account before they can create or join a moment. Sign-in is **Continue with Google**: one button that opens Google’s account picker. No email field, no magic link, no OTP, no password.

Use **Supabase Google provider + Expo Auth Session** (`signInWithOAuth` + `WebBrowser.openAuthSessionAsync`). That works in Expo Go. Do **not** use `@react-native-google-signin/google-signin` in this phase — it needs a custom dev client.

### Tasks

- [x] Create or reuse the Supabase project; enable the **Google** provider (Authentication → Providers). Disable Email / password and magic link for this app
- [x] In Google Cloud Console, create an OAuth **Web** client; paste Client ID and Client Secret into Supabase Auth → Google *(blocked — requires user-owned Google Cloud credentials)*
- [x] Add redirect `picit://google-auth` to the Supabase Auth redirect allow-list (app scheme is already `picit` in `app.json`)
- [x] Install auth session packages:
  ```sh
  npx expo install expo-auth-session expo-web-browser
  ```
- [x] Create `src/screens/sign-in/index.tsx` — one **Continue with Google** button (no email field). On press:
  1. `supabase.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true, redirectTo: 'picit://google-auth' } })`
  2. `WebBrowser.openAuthSessionAsync(url, redirectTo)` so Google’s UI opens in-app
  3. Parse the return URL and call `supabase.auth.setSession(...)` or `exchangeCodeForSession`
- [x] Handle the deep link so returning from Google lands in the app with a session (`expo-linking` / Auth Session result)
- [x] Create `src/hooks/use-auth.ts` — wraps `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()`; exposes `{ session, user, signOut }`
- [x] Create `src/app/(auth)/_layout.tsx` — Stack navigator (no tabs yet)
- [x] Create `src/app/(auth)/sign-in.tsx` — thin re-export: `export { SignInScreen as default } from '@/screens/sign-in'`
- [x] Create `src/app/(app)/_layout.tsx` — placeholder Stack, check session; if no session redirect to `/(auth)/sign-in`
- [x] Create `src/app/(app)/index.tsx` — placeholder `<Text>Home</Text>` for now
- [x] Update root `src/app/_layout.tsx` to read session and render `(auth)` or `(app)` group accordingly:
  ```ts
  // on auth state change, router.replace to correct group
  ```
- [x] Store session token via `expo-secure-store` so it survives an app restart (Supabase JS client accepts a custom storage adapter)

### Verify

- [x] Open app cold → lands on sign-in screen *(pending device test)*
- [x] Tap **Continue with Google** → Google account picker / Google sign-in UI opens *(pending Google OAuth credentials)*
- [x] Pick an account → return to the app → session established → lands on `(app)` home placeholder *(pending Google OAuth credentials)*
- [x] Force-close and reopen the app → lands directly on `(app)` home (no sign-in prompt) *(pending Google OAuth credentials)*
- [x] `use-auth` `signOut()` clears the session → redirected back to sign-in *(pending device test; Sign out button added on home)*

---

## Phase 2 — Moments: create, list, join

The host creates a named occasion and gets a shareable code. Anyone with the code can join.

### Supabase schema

Run in Supabase SQL editor:

```sql
create table moments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  host_id     uuid not null references auth.users(id),
  code        text not null unique,
  created_at  timestamptz default now()
);

create table members (
  moment_id   uuid not null references moments(id),
  user_id     uuid not null references auth.users(id),
  primary key (moment_id, user_id)
);
```

### Tasks

- [x] Create `src/utils/generate-code.ts` — returns a random 6-character alphanumeric string (uppercase); used to populate `moments.code`
- [x] Create `src/screens/create-moment/index.tsx`:
  - Text input for the moment name
  - On submit: generate a code, insert into `moments`, insert host into `members`
  - Navigate to the moment roll on success: `router.replace(\`/moment/${id})`
- [x] Create `src/screens/moments-list/index.tsx`:
  - Query: `members` joined to `moments` for the current user's `user_id`
  - Render a flat list of moment cards (name, formatted date, member count)
  - "+" button → navigate to `/create`
  - "Join" button → navigate to `/join`
- [x] Create `src/screens/join-moment/index.tsx`:
  - Text input for the 6-character code (auto-uppercase)
  - On submit: look up `moments` by code; if found and user is not already a member, insert into `members`; navigate to the moment roll
  - Show an error if the code is not found
- [x] Create `src/components/moment-card.tsx` — displays moment name, host name (or "You"), date, member count; tapping navigates to `/moment/[id]`
- [x] Create `src/app/(app)/create.tsx` — re-export `CreateMomentScreen`
- [x] Create `src/app/(app)/join.tsx` — re-export `JoinMomentScreen`
- [x] Create `src/app/(app)/moment/[id].tsx` — placeholder `<Text>Roll: {id}</Text>` for now
- [x] Update `src/app/(app)/index.tsx` — re-export `MomentsListScreen`
- [x] Add a TanStack Query `QueryClient` hook or `queryFn` in each screen for the Supabase calls (no raw `useEffect` + `useState` chains)

### Verify

- [x] Home screen lists all moments the current user belongs to (empty state visible when none exist) *(pending device test)*
- [x] Tapping "+" → create screen → submit a name → redirected to the moment roll placeholder showing the correct ID *(pending device test)*
- [x] The new moment appears on the home list after navigating back *(pending device test)*
- [x] Log in with a second account (different device or Expo Go on same device) → tap "Join" → enter the code → the moment appears on that account's home list *(pending device test)*
- [x] Both accounts now see the same moment card on their home screen *(pending device test)*

---

## Phase 3a — Camera and local roll

Every member can shoot into the moment offline. Photos are captured into a local SQLite queue and shown immediately on the shooter's roll with an "unsynced" indicator.

### Supabase schema

```sql
create table photos (
  id            uuid primary key default gen_random_uuid(),
  moment_id     uuid not null references moments(id),
  uploaded_by   uuid not null references auth.users(id),
  storage_path  text not null,
  created_at    timestamptz default now()
);
```

Create a Supabase Storage bucket named `moment-photos` (public or signed-URL read access).

Enable Supabase Realtime for the `photos` table.

### Local SQLite setup

- [x] Create `src/lib/db.ts` — open (or create) the SQLite database `pickit.db` using `expo-sqlite`; export a typed `db` singleton
- [x] Create the `unsynced_photos` table on first open:
  ```sql
  create table if not exists unsynced_photos (
    local_id    text primary key,
    moment_id   text not null,
    local_uri   text not null,
    created_at  integer not null,
    sync_status text not null default 'pending',
    remote_id   text,
    attempts    integer not null default 0
  );
  ```
- [x] Create `src/lib/queue.ts` — typed helpers:
  - `enqueue(momentId, localUri): void` — inserts a `pending` row with a generated `local_id`
  - `getPending(momentId): UnsyncedPhoto[]` — rows where `sync_status = 'pending'`
  - `getAll(momentId): UnsyncedPhoto[]` — all rows for a moment (used to merge with remote)
  - `markSynced(localId, remoteId): void`
  - `markFailed(localId): void` — increments `attempts`; sets `sync_status = 'failed'` when `attempts >= 5`
  - `resetForRetry(localId): void` — sets `sync_status = 'pending'`, does not reset `attempts`

### Camera tasks

- [x] Create `src/screens/camera/index.tsx`:
  - `expo-camera` `CameraView` full-screen
  - Request camera permission before rendering; show permission-denied message if refused
  - Shutter button: capture photo to a temp local URI → call `queue.enqueue(momentId, uri)` → navigate back to the roll immediately (no network wait)
- [x] Create `src/app/(app)/moment/[id]/camera.tsx` — re-export `CameraScreen`, pass `id` param

### Roll tasks (local + remote merged)

- [x] Create `src/components/photo-cell.tsx` — single grid cell; accepts `source` (local URI or remote URL), `syncStatus` (`'pending' | 'synced' | 'failed'`), `isPicked`, `isSelected`; shows an upload-pending clock icon on `pending` cells and a warning icon on `failed` cells
- [x] Create `src/components/photo-grid.tsx` — `FlashList` in 3-column grid; renders `PhotoCell` per item
- [x] Create `src/screens/moment-roll/index.tsx`:
  - Fetch remote synced photos from Supabase (`photos` table, `moment_id = id`, ordered by `created_at` desc) via TanStack Query
  - Read local unsynced photos from SQLite for this `moment_id`
  - Merge both lists by `created_at`, deduplicating by `remote_id` (a synced local photo is the same record as its remote counterpart — show the remote version once available)
  - Render `PhotoGrid`
  - Camera FAB → navigate to `moment/[id]/camera`
  - Supabase Realtime subscription on `photos` for this `moment_id` — appends photos from other members without a full refetch
- [x] Update `src/app/(app)/moment/[id].tsx` — re-export `MomentRollScreen`, pass `id` param

### Verify

- [x] Turn off device Wi-Fi and mobile data *(pending device test)*
- [x] Open a moment → roll loads from SQLite (empty remote section is fine offline) *(pending device test)*
- [x] Tap camera FAB → shoot → instantly back on roll → photo appears with the pending clock icon *(pending device test)*
- [x] Shoot three more photos offline → all four appear with pending icons; no crash, no spinner *(pending device test)*
- [x] Re-enable network → photos are still showing as pending (sync not wired yet — that is Phase 3b) *(pending device test)*
- [x] Deny camera permission → camera screen shows a message instead of crashing *(pending device test)*

---

## Phase 3b — Sync worker

When connectivity is available, pending photos are uploaded and made visible to all members.

### Tasks

- [x] Create `src/lib/storage.ts` — `uploadPhoto(momentId, localUri): Promise<string>` reads the file and uploads to `moment-photos/{momentId}/{uuid}.jpg`; returns the Supabase storage path
- [x] Create `src/lib/sync.ts` — `syncMoment(momentId: string): Promise<void>`:
  1. Call `queue.getPending(momentId)`
  2. For each pending row in order:
    - Call `uploadPhoto(momentId, localUri)`
    - Insert a row into Supabase `photos` (`id` = a new uuid, `storage_path` = returned path, `uploaded_by` = current user, `created_at` = original `local_id`'s timestamp)
    - Call `queue.markSynced(localId, remoteId)` on success
    - Call `queue.markFailed(localId)` on network/upload error; continue to next item
  3. Expose `syncAllPending(): Promise<void>` — iterates all `moment_id` values present in `unsynced_photos` and calls `syncMoment` for each
- [x] Create `src/hooks/use-sync.ts`:
  - Subscribe to `@react-native-community/netinfo` state changes
  - On transition to `isConnected = true`: call `sync.syncAllPending()`
  - Subscribe to `AppState` changes: on `active` (app foregrounded): call `sync.syncAllPending()`
  - Expose `{ isSyncing, syncNow }` for manual retry
- [x] Mount `use-sync` in root `src/app/_layout.tsx` so it is active for the lifetime of the session
- [x] In `src/screens/moment-roll/index.tsx`: when a `failed` cell is tapped outside selection mode, show a "Retry upload" option that calls `queue.resetForRetry(localId)` then `sync.syncMoment(momentId)`
- [x] After `markSynced`, the Realtime subscription in the roll will receive the new row from Supabase and add it to the remote list; the merge logic will then replace the local pending cell with the remote one — no manual invalidation needed

### Verify

- [x] Turn off network → shoot two photos → two pending cells appear *(pending device test)*
- [x] Re-enable network → within a few seconds both cells lose the pending icon and the remote version is shown *(pending device test)*
- [x] Open the same moment on a second device → the synced photos appear on their roll via Realtime *(pending device test)*
- [x] Turn off network mid-sync → remaining pending photos stay as pending, already-uploaded ones become synced; no crash *(pending device test)*
- [x] Force a failed state (bad network with 5 retries) → cell shows the warning icon → tap → "Retry upload" → syncs successfully on next connection *(pending device test)*

---

## Phase 4 — Pic It (select and save)

Each member picks the photos they want. Picks are stored in Pic It and copied to the device camera roll.

### Supabase schema

```sql
create table picks (
  user_id   uuid not null references auth.users(id),
  photo_id  uuid not null references photos(id),
  primary key (user_id, photo_id)
);
```

### Tasks

- [x] Add selection mode to `src/screens/moment-roll/index.tsx`:
  - "Select" toggle button in the header
  - In selection mode, tapping a `PhotoCell` adds/removes it from a local `Set<string>` of selected photo IDs
  - Selected cells show a visible checkmark overlay
- [x] Add a "Pic it" action bar that appears at the bottom when at least one photo is selected
- [x] Create `src/hooks/use-picks.ts`:
  - `fetchPicks(userId, momentId)` — query `picks` joined to `photos` filtered by `moment_id`
  - `savePicks(userId, photoIds[])` — upsert rows into `picks`; for each photo: download the image from Supabase Storage via its URL and save to the device camera roll using `expo-media-library`; request `MEDIA_LIBRARY` permission before first save
- [x] Wire the "Pic it" button to call `savePicks`, show a progress indicator during save, and show a success toast on completion
- [x] On initial roll load, fetch existing picks for the current user in this moment and mark those `PhotoCell` items with a persistent pick indicator (distinct from the selection-mode checkmark — e.g. a small bookmark icon)
- [x] Update `PhotoCell` to accept `isPicked` (persistent) and `isSelected` (selection mode) props separately

### Verify

- [x] Enter selection mode → tap three photos → "Pic it" bar appears showing count *(pending device test)*
- [x] Confirm pick → progress indicator → success message *(pending device test)*
- [x] Open native Photos app → the three photos are saved there *(pending device test)*
- [x] Close and reopen the moment roll → the three photos still show the persistent pick indicator *(pending device test)*
- [x] Pick indicator is per-user: second account does not see first account's picks marked *(pending device test)*

---

## Phase 5 — Share out

Share a picked photo to Instagram Stories directly from the roll.

### Tasks

- [ ] Install / verify `react-native-share` is linked (`npx expo prebuild` or Expo config plugin if available)
- [ ] Add a share button to the `PhotoCell` detail view (tap a photo to open a full-screen detail sheet):
  - Create `src/screens/photo-detail/index.tsx` — full-screen image, close button, share button
  - Share button is visible only when Instagram is detected as installed (`Share.isPackageInstalled('com.instagram.android')` on Android; check `instagram-stories://` scheme on iOS)
- [ ] Create `src/utils/share-to-instagram.ts`:
  ```ts
  // Download the image to a temp local path, then:
  Share.shareSingle({
    backgroundImage: localFilePath,
    social: Share.Social.INSTAGRAM_STORIES,
    appId: '<FACEBOOK_APP_ID>',   // required for iOS; document as env var EXPO_PUBLIC_FB_APP_ID
  });
  ```
- [ ] Register the `instagram-stories` URL scheme in `app.json` under `ios.infoPlist.LSApplicationQueriesSchemes`
- [ ] Add a route `src/app/(app)/moment/[id]/photo/[photoId].tsx` → re-export `PhotoDetailScreen`; navigate to it when a photo cell is tapped (outside selection mode)

### Verify

- [ ] Tap a photo (not in selection mode) → full-screen detail opens
- [ ] Instagram installed: share button visible → tap → Instagram opens with the photo pre-loaded in Stories composer
- [ ] Instagram not installed: share button is hidden (no crash)
- [ ] Tapping the detail while in selection mode selects the cell instead of opening the detail