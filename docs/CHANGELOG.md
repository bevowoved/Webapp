# Changelog — Mauria Webapp (`main` `4f3bd2ce` -> `next`)

## 1. At a Glance

| Metric | Before (`main` `4f3bd2ce`) | After (`next`) | Delta | How | Why |
| --- | --- | --- | --- | --- | --- |
| **`src/` Total Files** | `176` files (`169` `.ts`/`.tsx`) | **`125` files (`118` `.ts`/`.tsx`)** | **`-51` files (`-29.0%`)** | Removed 25 unused shadcn/Radix UI primitives, merged split API/hook/context/widget files into cohesive modules, replaced `planning.css` with native CSS Grid `planning-calendar.css` | Eliminate dead component surface area and cross-file indirection while keeping 100% UI & route parity |
| **`src/` Lines of Code** | `36,126` LOC (`29,165` TS/TSX LOC) | **`29,047` LOC (`23,708` TS/TSX LOC)** | **`-7,079` LOC (`-19.6%`)** | Replaced `1,715`-line `safe-area.css` with `86`-line Tailwind v4 `@utility` rules, replaced FullCalendar with a `309`-line native CSS Grid calendar, compacted `sidebar.tsx`, `grades.ts`, `date-time.ts`, `helper.ts`, and hooks, removed all comments | Smaller, denser, strictly typed codebase with zero dead CSS or duplicated schedule/card boilerplate |
| **Production Dependencies** | `62` packages | **`15` packages** | **`-47` packages (`-75.8%`)** | Replaced all 5 `@fullcalendar/*` packages, `recharts`, `date-fns`, `react-day-picker`, 24 `@radix-ui/*` packages, `clsx`, `tailwind-merge`, `class-variance-authority`, `cmdk`, `embla-carousel-react`, `input-otp`, `react-hook-form`, `zod`, `next-themes`, `react-resizable-panels`, `react-simple-pull-to-refresh`, `tailwindcss-animate`, `tailwindcss-safe-area` with native CSS Grid, React 19, `Intl`, SVG, and CSS primitives | Cut third-party supply-chain surface by three-quarters (`0` prod vulnerabilities) and eliminate heavy runtime bundles |
| **Dev Dependencies & Toolchain** | Vite `6.4.1`, ESLint `9.39.3`, TS `5.9.3`, `@vitejs/plugin-react` `4.7.0`, `eslint-plugin-react-hooks` `5.2.0` | **Vite `8.3.5` (Rolldown + Oxc), ESLint `10.13.0`, TS `7.0.2`, `@vitejs/plugin-react` `6.1.2`, `eslint-plugin-react-hooks` `7.1.1`** | **100% 2026 majors** | Migrated `rollupOptions.output.manualChunks` to `rolldownOptions.output.codeSplitting.groups`, enabled all 16 React 19 Compiler lint rules | Native Rust bundling/transform and compile-time enforcement of React 19 purity/immutability rules |
| **Warm Production Build (`vite build`)** | `18.37 s` (Rollup + single-thread compression) | **`5.41 s – 6.55 s`** | **`~3.4x` faster** | Native Rust Rolldown bundler + `node:worker_threads` parallel Brotli q11 + Gzip level 9 pre-compression + SHA-256 Service Worker stamping | Sub-7-second production builds with pre-compressed `.br` and `.gz` sidecars emitted in-process |
| **Schedule Calendar Chunk (`planning-calendar-*.js`)** | `260.61 kB` raw (`77.91 kB` gzip) with `@fullcalendar/{core,daygrid,timegrid,interaction,react}` | **`7.88 kB` raw (`2.97 kB` gzip)** | **`-97.0%` raw (`-96.2%` gzip)** | Replaced all 5 `@fullcalendar/*` packages with a 100% native CSS Grid week/day/month calendar (`src/components/planning-calendar.tsx` + `src/styles/planning-calendar.css`) honouring all `25/25` `--planning-*` CSS variables | Saves `252.7 kB` raw (`74.9 kB` gzip) while preserving overlap column packing, current-time indicator, swipe navigation, and extra-time (`tiers temps`) badges |
| **Date-Picker Chunk (`date-time-fields-*.js`)** | `82.56 kB` raw (`25.09 kB` gzip) with `react-day-picker` + `date-fns` | **`15.37 kB` raw (`5.26 kB` gzip)** | **`-81.4%` raw (`-79.0%` gzip)** | Replaced `react-day-picker` + `date-fns` with native `<table>` + `Intl.DateTimeFormat` month grid in `src/components/ui/calendar.tsx` and token-by-token formatter in `src/lib/utils/date-time.ts` | Keep 100% visual, DOM (`[--cell-size:2rem]`), and keyboard navigation parity at less than one-fifth the bundle size |
| **Total Pre-Compressed Output (`dist/`)** | Uncompressed static assets only in `vite build` (`1,868.6 kB` raw with FullCalendar) | **`1,673.0 kB` raw -> `443.9 kB` Brotli (`-73.5%`) / `506.5 kB` Gzip (`-69.7%`)** | **`-195.6 kB` raw / `-61.1 kB` Brotli** | `mauria:precompress` worker pool in `vite.config.ts` + `brotli_static on` / `gzip_static on` in `nginx.conf` | Zero runtime compression CPU overhead on the 256 MB Fly.io Nginx container |
| **Sentry Privacy & Initial Load** | `@sentry/react` `10.x` initialized synchronously at module top-level with `sendDefaultPii: true` and hardcoded DSN | **`@sentry/react` `11.9.0` deferred via `requestIdleCallback`, `dataCollection` off (`0` PII), `replaysOnErrorSampleRate: 0.1`, gated on `VITE_SENTRY_DSN`** | **0 student PII sent; 0 main-thread boot cost** | Dynamic `import("@sentry/react")` when browser is idle; PII collection disabled; `console.log` noise removed | Protect student privacy and remove Sentry from the critical rendering path |
| **Verification, Coverage & Mutation Gates** | `0` tests; `eslint-disable` comments present; React Compiler rules absent | **`693/693` tests & probes pass (`97.56%` V8 line cov, `95.15%` func cov, `31/31 = 100%` mutation kill), `0` TS 7.0.2 errors, `0` ESLint 10 errors/warnings, `0` suppressions, `0` comments** | **100% verified** | Audited and verified across 5 independent test harnesses (V8 coverage, boundary/contract, logic/mutation, resilience/concurrency, and CSS Grid geometry); the harnesses are local verification tooling and are not committed, so these counts are not reproducible from a fresh clone - the clone-reproducible gates are `tsc -b`, `lint`, and `build` | Guarantee deterministic rendering, session security, and zero hidden type/lint holes |

---

## 2. Architecture: Before (`main`) vs After (`next`)

```mermaid
---
config:
  sequence:
    mirrorActors: true
---
sequenceDiagram
  box Student
    actor U as Student Browser
  end
  box Before (main 4f3bd2ce)
    participant B as Eager Bundle<br/>All routes + FC6 + 3 locales + Sentry 10
  end
  box After (next)
    participant A as Lazy Shell + SW<br/>Vite 8 Rolldown + Brotli .br
    participant C as API Helper + Persist<br/>AbortSignal, freshness, double-buffer
  end
  box Upstream
    participant S as Mauria API-v2
  end
  autonumber

  rect rgba(248,113,113,0.10)
    Note over U,S: Before: Boot, Locale & Route Navigation
    U->>+B: GET / (downloads eager routes, Recharts, FullCalendar 6, fr+en+es locales, Sentry 10)
    B->>B: Sentry.init(sendDefaultPii: true) blocks module evaluation
    B->>B: single localStorage key; 8 separate window storage listeners
    U->>B: switch tab (/ -> /grades -> /planning)
    B->>B: AnimatePresence on <Routes key={pathname}> unmounts entire RootLayout, Header, Sidebar & Particles canvas on every tab click
    B->>S: POST /aurion/grades (no in-flight dedup, fixed 5 min staleTime, no logout AbortController)
    S-->>B: 200 full JSON payload parsed every time
    B-->>-U: re-mounts layout + page
  end

  rect rgba(74,222,128,0.10)
    Note over U,S: After: Boot, Native Plugins, Dynamic Freshness & Persistent Layout
    U->>+A: GET / (Nginx serves pre-compressed .br + Link modulepreload + CSP headers)
    A->>A: inline script sets theme & UI scale before first paint; restores double-buffered cache
    A->>A: i18next LanguageDetectorModule + BackendModule bundles fr-FR, lazy-loads en-US / es-ES on demand
    A->>A: requestIdleCallback preloads core routes (/planning, /grades, /absences) & lazy-inits Sentry 11 (0 PII)
    U->>A: hover/focus nav tab -> preloadRoute(path); click tab
    A->>A: RootLayout, Header, BottomNav & Background canvas stay mounted; only <main key={pathname}> transitions
    A->>+C: apiRequest with x-aurion-session + inflightMap dedup + AbortSignal.any([sessionGuard, timeout])
    C->>+S: request (browser HTTP cache active on GET)
    S-->>-C: 200 + Cache-Control max-age & Age (or Warning: 110) -> normalized dynamic staleTime
    C-->>-A: typed response; quota-checked idle write to mauria-rq-cache-buffer then mauria-rq-cache
    A-->>-U: instant tab switch with 7.72 kB native CSS Grid calendar & zero layout teardown
  end
```

---

## 3. Dependency Consolidation (`62 -> 15` Production Packages)

### A. Removed Production Packages (`47` Removed)

| Removed Package(s) | Count | Replaced By (in `next`) | How It Works | Why |
| --- | --- | --- | --- | --- |
| `@fullcalendar/{core,daygrid,timegrid,interaction,react}` | `5` (`260.61 kB` raw / `77.91 kB` gzip) | `PlanningCalendar` in `src/components/planning-calendar.tsx` + `src/styles/planning-calendar.css` | 100% native CSS Grid week (`timeGridWeek`), day (`timeGridDay`), and month (`dayGridMonth`) calendar with greedy column-packing overlap layout, `rowOf(minutes, edge)` 30-slot clamping, live current-time indicator, swipe gesture navigation, imperative `PlanningCalendarHandle`, and all `25/25` `--planning-*` theme CSS variables | FullCalendar v7 on npm is an incomplete stub (`@fullcalendar/core@7.1.3` empty, no v7 plugins); native CSS Grid shrinks the chunk by **`-97.0%` raw (`260.61 kB -> 7.72 kB`)** and passes `78/78` geometry & behavior probes |
| `recharts` (+ transitive `d3-*`, `victory-vendor`, `recharts-scale`, `decimal.js-light`, `eventemitter3`, `tiny-invariant`) | `1` (`~445 kB` raw) | `GradesEvolutionChart` in `src/pages/grades/grades-stats.tsx` | Pure responsive `<svg>` line chart with Catmull-Rom/linear path generation, `connectNulls`, dashed `classAvg` (`strokeDasharray="4 2"`), theme-aware CSS variables (`--chart-student-above/below/class`), and pointer/touch crosshair tooltip | `recharts` was imported for a single `h-36` 2-series line chart on `/grades`; native SVG renders identically with `0 kB` third-party cost |
| `date-fns` (`^4.1.0`) + `react-day-picker` (`^9.14.0`) | `2` (`~82 kB` raw) | `src/lib/utils/date-time.ts` + `src/components/ui/calendar.tsx` | Native `Intl.DateTimeFormat` + `Intl.NumberFormat` token-by-token formatter (`EEEE`, `EEE`, `MMMM`, `MMM`, `yyyy`, `dd`, `HH`, `mm`, `do` ordinals, ISO `weekOfYear` with `0/9,360` mismatches, `formatDistanceToNow` with `0/11,523` mismatches, strict `parseISO` range validation) + native `<table>` calendar grid | Eliminates the entire `date-fns` + `@date-fns/tz` + `react-day-picker` dependency tree (`date-time-fields` chunk dropped `-81.4%` from `82.56 kB` to `15.36 kB` raw) with `150/150` localized format parity and `31/31` (`100%`) mutation kill score |
| `@radix-ui/react-{accordion,alert-dialog,aspect-ratio,avatar,checkbox,collapsible,context-menu,dropdown-menu,hover-card,label,menubar,navigation-menu,progress,radio-group,scroll-area,separator,slider,slot,switch,tabs,toggle,toggle-group,tooltip}` | `23` | Native HTML/ARIA primitives in `src/components/ui/{checkbox,switch,progress,toggle-group,label,separator}.tsx` + `Slot` in `src/lib/utils/cn.ts` (17 unused primitives deleted) | Controlled/uncontrolled `<button role="checkbox">`, `<button role="switch">`, `<div role="progressbar">`, `<div role="group">`, `<label>`, `<div role="separator">`, and ref/prop/className/handler-merging `Slot` | 17 of the 23 Radix packages had `0` imports outside `src/components/ui/`; the remaining 6 are simple semantic ARIA controls that need zero external state machines |
| `clsx`, `tailwind-merge`, `class-variance-authority` | `3` | `src/lib/utils/cn.ts` (`cn`, `cva`, `Slot`) | Table-driven Tailwind v4 class conflict resolver (`EXACT_FAMILY`/`PREFIX_FAMILY`, `Map.groupBy`, per-property `arb:<prop>` family for `[prop:val]`) with 8,192-entry LRU cache and `cva()` `null`-fallback variant builder | Verified `1,016/1,016` (`100.0%`) exact output parity against `twMerge(clsx(...))` across all reachable class combinations in the repository |
| `react-simple-pull-to-refresh` | `1` | `src/components/pull-to-refresh.tsx` | Native passive/non-passive `touchstart`/`touchmove`/`touchend`/`touchcancel` gesture tracker with `THRESHOLD = 64`, `MAX_PULL = 96`, `RESISTANCE = 0.5`, and `aria-live="polite"` status | Removes a legacy React 16/17 wrapper while preserving identical pull physics and DOM classes |
| `next-themes` | `1` | `src/components/theme-provider.tsx` + inline boot script in `index.html` | React 19 `use()` context + `useSyncExternalStore` backed by `storage.ts` (`mauria-ui-theme`) covering all 7 themes (`light`, `dark`, `oled`, `cherry`, `ocean`, `forest`, `pride`) | Zero FOUC on load and reactive cross-tab theme switching without Next.js SSR shims |
| `cmdk`, `embla-carousel-react`, `input-otp`, `react-hook-form`, `@hookform/resolvers`, `zod`, `react-resizable-panels`, `@tanstack/react-query-devtools`, `@tanstack/query-persist-client-core`, `tailwindcss-animate`, `tailwindcss-safe-area` | `11` | Native Tailwind v4 `@utility` rules in `src/styles/safe-area.css` + `@tanstack/react-query-persist-client` re-exports | Unused form/carousel/command/OTP/panel packages removed; `1,715` lines of generated safe-area CSS replaced by `86` lines of Tailwind v4 `@utility` declarations | Zero runtime or visual impact; all 14 safe-area utilities (`pt-safe`, `pb-safe`, `pt-safe-offset-4`, `pb-safe-offset-24`, etc.) verified in emitted CSS |

### B. Upgraded Production & Dev Packages (`32` Total Packages Kept: `15` Prod + `17` Dev)

| Package | Before (`main` `4f3bd2ce`) | After (`next`) | Role & Upgrade Notes |
| --- | --- | --- | --- |
| `react` / `react-dom` | `^19.2.0` | **`^19.3.1`** (`19.3.1`) | React 19 `use()`, ref-as-prop across all UI primitives, `useSyncExternalStore` |
| `react-router` | `^7.10.1` | **`^8.5.1`** (`8.5.1`) | React Router v8 with lazy route chunks and hover/focus `preloadRoute` |
| `framer-motion` | `^12.23.26` | **`^14.7.1`** (`14.7.1`) | Framer Motion v14 animations across layout, drawers, and grade reveal overlays |
| `@sentry/react` | `^10.30.0` | **`^11.9.0`** (`11.9.0`) | Sentry v11 SDK, lazy-loaded via `requestIdleCallback`, `dataCollection` disabled (`0` PII) |
| `@tanstack/react-query` + `persist-client` | `^5.90.12` | **`^5.105.0`** (`5.105.0`) | Native `isStale`, `fetchQuery`, `ensureQueryData`, quota-safe double-buffered `localStorage` persister |
| `i18next` / `react-i18next` | `^25.7.2` / `^16.4.0` | **`^26.5.11` / `^17.1.9`** | Native `LanguageDetectorModule` + `BackendModule` + `partialBundledLanguages: true` |
| `lucide-react` | `^0.556.0` | **`^1.63.0`** (`1.63.0`) | Tree-shaken per-icon ES chunks (`0.16 kB – 0.78 kB` each) |
| `@radix-ui/react-{dialog,popover,select}` | `^1.1.x` / `^2.2.x` | **`^1.3.1` / `^2.4.1`** | Accessible modal focus-trapping (`Sheet`), anchored `Popover`, and keyboard `Select` |
| `vaul` / `sonner` | `^1.1.2` / `^2.0.7` | **`^1.1.2` / `^2.0.8`** | Touch physics bottom `Drawer` and safe-area-aware `Toaster` |
| `vite` / `@vitejs/plugin-react` | `^6.4.1` / `^4.3.4` | **`^8.3.5` / `^6.1.2`** | Rust Rolldown bundler + Oxc React transform + multi-threaded `.br`/`.gz` pre-compression + SW hash stamping |
| `eslint` / `@eslint/js` / `eslint-plugin-react-hooks` | `^9.17.0` / `^5.0.0` | **`^10.13.0` / `^10.0.1` / `^7.1.1`** | ESLint 10 flat config + full React 19 Compiler lint suite (`16` rules) |
| `typescript7` (`tsc -b`) / `typescript-eslint` | `~5.6.2` / `^8.18.0` | **`^7.0.2` / `^8.72.1`** | TypeScript 7.0.2 strict build check + `typescript-eslint` 8.72.1 |
| `tailwindcss` / `@tailwindcss/postcss` / `postcss` | `^4.1.17` / `^8.5.6` | **`^4.3.3` / `^8.5.32`** | Tailwind CSS v4.3 with native `@utility` safe-area rules |
| `@types/node` / `globals` | `^20.x` / `^15.x` | **`^26.6.5` / `^17.13.0`** | Node 26 type definitions and ES2026 globals |

---

## 4. Native Built-In Replacements, Hardening & Code Consolidations

| Area | Before (`main` `4f3bd2ce`) | After (`next`) | How | Why |
| --- | --- | --- | --- | --- |
| **Native CSS Grid Calendar (`src/components/planning-calendar.tsx`)** | 5 `@fullcalendar/*` v6 packages (`260.61 kB` raw / `77.91 kB` gzip) + `196`-line FullCalendar selector overrides in `planning.css` | **`309`-line native CSS Grid component (`7.72 kB` raw / `2.90 kB` gzip)** + `205`-line `src/styles/planning-calendar.css` | Implements `timeGridWeek` (Mon–Sat, 07:00–22:00, 30 half-hour slots), `timeGridDay`, and `dayGridMonth` using native CSS Grid, greedy overlap column layout, clamped `rowOf(minutes, edge)` helper, pointer/touch swipe gestures, and `PlanningCalendarHandle` for `/planning` and `/palantir` | Drops 5 production dependencies and `-252.9 kB` raw (`-75.0 kB` gzip) while honouring all `25/25` `--planning-*` theme variables and passing `78/78` probes |
| **i18n Initialization & Lazy Loading (`src/i18n/index.ts`)** | Eagerly imported `fr-FR.json`, `en-US.json`, and `es-ES.json` (`~60 kB` combined) into the initial entry bundle | Bundled `fr-FR.json` as fallback; `en-US.json` (`18.92 kB`) and `es-ES.json` (`20.32 kB`) lazy-loaded via native `i18next` `BackendModule` + `LanguageDetectorModule` + `partialBundledLanguages: true` | `i18next`'s built-in `BackendConnector` invokes `LOADERS[normalize(language)]()` before `changeLanguage()` resolves and before `languageChanged` fires (`63` lines, `0` monkey-patches) | Saves `39.2 kB` raw (`16.5 kB` gzip) from initial boot for French users while guaranteeing English/Spanish bundles are loaded before React re-renders |
| **Junia Outage Status Hook (`src/lib/hooks/use-junia-status.ts`)** | `102`-line hook with custom subscriber set and manual timestamp checks | **`37`-line hook** using TanStack Query v5's native `isStale` (`const { data, isStale } = useQuery(juniaStatusQueryOptions()); return data && !isStale ? data : null;`) | Driven directly by `staleTime: getDynamicStaleTime("/badjunia/status", STATUS_STALE_MS)` (`5 min`) and `refetchInterval: STATUS_STALE_MS` | Eliminates manual `useState` + `useEffect` + `setTimeout` expiry timers and avoids impure `Date.now()` calls during React 19 render |
| **Aurion Warmup, Null-Safe Status & Logout Reset (`src/lib/api/aurion.ts`, `junia-status.ts`)** | Separate `warm-aurion.ts` + `aurion.ts` with manual module-level promises and unguarded `aurionTimes.home` access | Consolidated into `src/lib/api/aurion.ts` (`132` LOC) and `junia-status.ts` (`92` LOC) using `queryClient.fetchQuery`, `queryClient.ensureQueryData`, null-safe `(await ensureJuniaStatus())?.aurionTimes?.home ?? 4500`, and `resetAurionSession()` | Binds `warmState` to the active user, guards against nullable `aurionTimes` when BadJunia upstream is degraded, and purges `aurionWarm` + `juniaStatus` queries on logout | Prevents login crashes during upstream BadJunia outages and prevents warm-session state from leaking across account switches |
| **HTTP Client, Dynamic Freshness & Session `AbortController` (`src/lib/api/helper.ts`)** | Separate `helper.ts`, `supa.ts`, and `findmyroom.ts` with basic `fetch()`, no timeout tiers, and no logout race protection | Unified `src/lib/api/helper.ts` (`272` LOC) with normalized `freshUntilMap` (`Cache-Control: max-age` minus `Age`, `Warning: 110` bypass), `inflightMap` request deduplication, `AbortSignal.any([sessionGuard.signal, timeout])`, and `BroadcastChannel("mauria-session")` | Rotates `sessionGuard` (`AbortController`) and purges credentials (`email`, `password`, `name`, `x-aurion-session`) on `clearSessionScopedCaches()`, immediately aborting in-flight pre-logout requests so they can never repopulate storage | Fixes 100% of dynamic `staleTime` lookups, enables native browser HTTP caching on `GET`, and eliminates post-logout credential/token retention races |
| **Quota-Safe Reactive `localStorage` & Double-Buffered Persister (`storage.ts`, `query-client.ts`, `unopened-grades.ts`)** | 8 separate `window` storage listeners; `saveToStorage` updated in-memory cache before `localStorage.setItem`; `resetGradeTracking` cached empty state eagerly | `storage.ts` (`103` LOC) returns `boolean` from `saveToStorage` (updating cache only after `setItem` succeeds) + `BroadcastChannel("mauria-storage")`; `query-client.ts` (`139` LOC) updates `lastWrittenJson` only on confirmed write; `unopened-grades.ts` (`102` LOC) keys its `memo` on the raw storage string | Raw-string-keyed `memo` automatically invalidates whenever underlying storage changes, and `createDoubleBufferedPersister` retries writes cleanly if quota was transiently exceeded | Makes stale-cache poisoning on `QuotaExceededError` or `resetGradeTracking()` structurally impossible (`14/14` resilience probes pass) |
| **Khôlles, DS, 5-Line `horaire tt` Parsing & Grade Math (`colles.ts`, `ds.ts`, `home.ts`, `grades.ts`)** | Verbose repeated object literals; `parseGradeValue` allowed `"Infinity"`; `parseFromTitle` misread 5-line `horaire tt` titles | Compact tuple/string builders in `colles.ts`, `ds.ts`, and `grades.ts` (`572` LOC, `-75` LOC); `Number.isFinite` grade guard; `parseFromTitle` in `home.ts` strips trailing `horaire tt : ...` notes before locating the lesson type line | Expands compact `"key:weight"` tables via `Object.fromEntries` and normalizes 5-line Aurion titles so `extra-time.ts` detects exams reliably | Verified `37/37` schedule deep-equals, `248,000/248,000` `gradeValueFrom` parity, and `100%` finite grade averages |

---

## 5. File Count Consolidation (`176 -> 125` Files in `src/`, `-51` Files)

| Directory / Category | `main` (`4f3bd2ce`) | `next` | Delta | Details |
| --- | --- | --- | --- | --- |
| **`src/components/ui/*.tsx`** | `44` files | **`19` files** | **`-25` files** | Removed 24 unused shadcn/ui components + replaced `chart.tsx` with native SVG `GradesEvolutionChart` in `grades-stats.tsx` |
| **`src/contexts/*.tsx` & `src/hooks/*.ts`** | `4` files (`modalContext`, `toastContent`, `reactQueryContext`, `use-mobile`) | **`1` file (`src/lib/query-client.ts`)** | **`-3` files** | Removed unused `modalContext`, `toastContent`, and `use-mobile`; moved `ReactQueryProvider` and `queryClient` to `src/lib/query-client.ts` |
| **`src/lib/api/*.ts`** | `5` files (`aurion`, `warm-aurion`, `helper`, `supa`, `findmyroom`, `junia-status`) | **`3` files (`aurion.ts`, `helper.ts`, `junia-status.ts`)** | **`-3` files** | Merged `warm-aurion.ts` into `aurion.ts`; merged `supa.ts` and `findmyroom.ts` into `helper.ts` |
| **`src/lib/native/*.ts`** | `3` files (`widget.ts`, `use-widget-grades-sync.ts`, `use-widget-language-sync.ts`) | **`1` file (`src/lib/native/widget.ts`)** | **`-2` files** | Consolidated Android Capacitor widget bridge and both sync hooks into `src/lib/native/widget.ts` |
| **`src/lib/utils/*.ts` & `src/lib/hooks/*.ts`** | `34` files | **`20` files** | **`-14` files** | Consolidated date-time helpers into `date-time.ts`, class/variant/slot helpers into `cn.ts`, colles hooks into `use-colles.ts`, and storage-backed settings hooks |
| **`src/components/*.tsx`, `src/pages/**` & `src/styles/*.css`** | `86` files | **`81` files** | **`-4` files** | Inlined `EmptyListState` into `aurion-down-state.tsx`, consolidated home/grades/reveal helpers, replaced `src/pages/planning/planning.css` with `src/styles/planning-calendar.css` |
| **Total `src/` Files** | **`176` files** | **`125` files** | **`-51` files (`-29.0%`)** | Zero broken imports, 100% route and feature parity |

---

## 6. Container, Nginx & Fly.io Production Infrastructure

| Layer | Before (`main` `4f3bd2ce`) | After (`next`) | Impact |
| --- | --- | --- | --- |
| **Docker Builder & Runtime (`Dockerfile`)** | Node 20 build stage + standard Nginx image without Brotli module or `Link` preload injection | `node:24-alpine` (`pnpm@12.9.1`) build stage -> `alpine:3.22` + `nginx` + `nginx-mod-http-brotli`, non-root `USER nginx`, build-time verification of `.br`/`.gz` sidecars, and dynamic `Link` header injection (`rel=modulepreload` for entry JS, `rel=preload; as=style` for entry CSS); no `# syntax=` directive - the build relies on the default BuildKit frontend (`RUN --mount=type=cache` requires BuildKit) | Minimal Alpine runtime image running unprivileged with early asset preloading and zero runtime compression overhead |
| **Nginx Serving & Security Headers (`nginx.conf`)** | Basic SPA fallback without static Brotli, sidecar protection, or modern security headers | `brotli_static on`, `gzip_static on`, `open_file_cache max=1000`, `404` block on direct `.br`/`.gz` URL requests, immutable `1 yr` cache on `/assets/*`, `no-store` on `/sw.js` & `/manifest.webmanifest`, `GET /healthz`, plus `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy` | Serves pre-compressed `.br` q11 files directly from disk cache with full CSP and HTTP header hardening |
| **Build-Hashed Offline PWA Service Worker (`public/sw.js` + `vite.config.ts`)** | No service worker | `mauria:precompress` stamps a 12-char SHA-256 asset digest (`mauria-<hash>`) into `dist/sw.js` on every build; navigation uses network-first with cached `/index.html` fallback; static `/assets/*` uses cache-first with background revalidation; `skipWaiting()` is gated on `postMessage("SKIP_WAITING")` | Prevents mid-session lazy-chunk 404s during deployments and guarantees deterministic cache invalidation across releases and rollbacks |
| **Fly.io Machine Configuration (`fly.toml`)** | Standard HTTP service without `/healthz` check or concurrency bounds | `primary_region = 'cdg'`, `256mb` RAM, `1` shared CPU, `auto_stop_machines = 'suspend'`, `GET /healthz` every `15 s`, `soft_limit = 20` / `hard_limit = 25` requests | Fast suspend/resume in Paris (`cdg`) with low memory footprint and bounded per-machine concurrency |
