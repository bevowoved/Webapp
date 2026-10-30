<p align="center"><img src="https://github.com/MauriaApp.png" width="96" alt="MauriaApp"></p>

<p align="center">
<a href="https://react.dev"><img alt="React 19.3" src="https://img.shields.io/badge/react-19.3-61DAFB?logo=react&logoColor=black"></a>
<a href="https://vite.dev"><img alt="Vite 8.3" src="https://img.shields.io/badge/vite-8.3%20rolldown-646CFF?logo=vite&logoColor=white"></a>
<a href="https://www.typescriptlang.org"><img alt="TypeScript 7.0" src="https://img.shields.io/badge/typescript-7.0-3178C6?logo=typescript&logoColor=white"></a>
<a href="https://tailwindcss.com"><img alt="Tailwind CSS 4.3" src="https://img.shields.io/badge/tailwind-4.3-06B6D4?logo=tailwindcss&logoColor=white"></a>
<a href="https://tanstack.com/query"><img alt="TanStack Query 5" src="https://img.shields.io/badge/tanstack%20query-5.105-FF4154?logo=reactquery&logoColor=white"></a>
<a href="https://docs.sentry.io/platforms/javascript/guides/react/"><img alt="Sentry 11, no PII" src="https://img.shields.io/badge/sentry-11%2C%20no%20PII-362D59?logo=sentry&logoColor=white"></a>
<a href="https://fly.io/docs"><img alt="Fly.io 256 MB" src="https://img.shields.io/badge/fly.io-256%20MB%20nginx%20brotli-24175B?logo=flydotio&logoColor=white"></a>
</p>

# Mauria Webapp

Progressive web dashboard and Android hybrid companion for Junia students: live Aurion schedule with a zero-dependency CSS Grid week/day/month calendar, resolved khôlles/DS slots, and 1/3 extra-time (*tiers temps*) extension, grade analytics with weighted semester averages, a native SVG evolution chart, and 6 interactive reveal overlays, absences tracking, CROUS and Lacatho daily canteen menus, FindMyRoom free-classroom search, Palantir schedule directory, Junia Print balance and PDF submission, Aurion documents, local agenda tasks, and two-way Android home-screen widget synchronization.

```mermaid
---
config:
  sequence:
    mirrorActors: true
---
sequenceDiagram
  box Student
    actor U as Student<br/>Browser / Android
  end
  box Webapp
    participant S@{ "type": "boundary" } as index.html + SW<br/>theme, scale, hash cache
    participant R@{ "type": "control" } as React 19 + Router 8<br/>lazy routes, preload
    participant Q@{ "type": "database" } as TanStack Query 5<br/>double-buffered persist
    participant H@{ "type": "entity" } as API helper<br/>AbortSignal, freshness, seal
  end
  box Bridge
    participant W@{ "type": "collections" } as Android Widget<br/>& BroadcastChannel
  end
  box Upstream
    participant A@{ "type": "control" } as Mauria API-v2<br/>Fastify 5
  end
  autonumber

  rect rgba(74,222,128,0.10)
    Note over U,Q: Cold boot, paint-blocking theme/scale, and double-buffered cache restore
    U->>+S: GET / (Nginx serves Brotli .br + Link modulepreload + CSP headers)
    S->>S: inline script applies mauria-ui-theme (7 themes) & mauria-ui-scale before first paint
    S->>R: mount App, restore mauria-rq-cache (or -buffer fallback, 30 d maxAge)
    R->>S: window load -> register /sw.js (mauria-<sha256>), requestIdleCallback(preloadCoreRoutes, initSentry)
    S-->>-U: interactive shell rendered from persisted cache in < 1 frame
  end

  rect rgba(251,146,60,0.10)
    Note over U,A: Login, sealed session header, and preparation prefetch
    U->>+R: submit email & password on /login -> /welcome -> /campus -> /preparing
    R->>+H: ensureAurionWarm -> POST /aurion/warm {email, password}
    H->>+A: POST /aurion/warm, x-aurion-session?
    A-->>-H: 200 {success: true}, x-aurion-session (AES-256-GCM sealed token)
    H->>W: save aurionSessionHeader + BroadcastChannel("mauria-session") to open tabs
    H-->>-R: markAurionSession(aurionTimes?.home ?? 4500)
    par PreparingPage parallel warm prefetch
      R->>A: /aurion/planning, /aurion/grades, /aurion/absences
      R->>A: /messages, /lacatho/menu or /crous/castelru/menu, /badjunia/status
    end
    R-->>-U: navigate("/") with progress ring completion check
  end

  rect rgba(34,211,238,0.10)
    Note over U,A: Server freshness headers, in-flight deduplication, and session-scoped AbortController
    U->>+R: open or pull-to-refresh Home / Planning / Grades / Absences
    R->>+Q: useQuery(queryKey, staleTime: getDynamicStaleTime(path))
    Q->>+H: apiRequest(path, method, body)
    H->>H: join inflightMap if identical request is already running; bind AbortSignal.any([sessionGuard, timeout])
    H->>+A: GET or POST + x-aurion-session (browser HTTP cache active on GET)
    A-->>-H: 200 JSON + Cache-Control max-age + Age + Warning? + X-Session-State?
    H->>H: update freshUntilMap (remaining max-age - age; bypass on Warning: 110)
    H-->>-Q: typed response
    Q->>Q: quota-checked requestIdleCallback write to mauria-rq-cache-buffer then mauria-rq-cache
    Q-->>-R: render data
    R-->>-U: updated view
  end

  rect rgba(167,139,250,0.10)
    Note over U,W: Native CSS Grid PlanningCalendar (khôlles, DS, 1/3 extra-time) and Android widget sync
    U->>+R: view HomePage or PlanningPage
    R->>Q: read ["planning"], ["colles-group"], useExtraTimeEnabled()
    R->>R: useResolvedPlanning replaces generic CPG DS with group DS (ds.ts) + khôlles (colles.ts)
    R->>R: applyExtraTime stretches eligible DS end times by +1/3 duration
    R->>R: getHomeUpcoming splits into current, today, tomorrow + schedules next boundary timer
    opt Android Capacitor MauriaWidget plugin present
      R->>W: pushWidgetPlanning(upcoming 25 lessons), pushWidgetGrades(unopened + recent 15)
    end
    R-->>-U: rendered cards or 7.88 kB native CSS Grid week/day/month calendar with overlap columns & swipe gestures
  end

  rect rgba(232,121,249,0.10)
    Note over U,R: Grades tracking, native SVG evolution chart, and 6 reveal overlays
    A-->>Q: grades query success -> QueryCache.onSuccess(trackNewGrades)
    Q->>R: first-run guard records initial grades as known; subsequent new grades flagged unopened
    U->>+R: tap unopened grade card (Booster, CS2 Case, Scratch, Slots, Loot Box, or Wax Seal)
    R->>R: compute gradeValueFrom (Number.isFinite guarded), rarity tier, subject delta & trend badge
    R->>Q: markGradeOpened(gradeKey) -> raw-string-memoized storage dispatcher updates all subscribers
    R-->>-U: interactive reveal animation + SVG evolution line chart & semester averages
  end

  rect rgba(96,165,250,0.10)
    Note over U,W: Native i18next lazy locale pipeline and cross-tab BroadcastChannel storage store
    U->>+R: switch language (fr / en / es) or theme / background / campus in Sidebar or Settings
    R->>R: i18next LanguageDetectorModule + BackendModule lazy-loads en-US.json or es-ES.json
    R->>W: document.documentElement.lang updated + MauriaWidget.updateLanguage({language})
    R->>Q: saveToStorage("mauria-*") -> StorageEvent + BroadcastChannel("mauria-storage") notifies all tabs
    R-->>-U: instant re-render in target locale and theme
  end

  rect rgba(250,204,21,0.10)
    Note over U,A: Hard states: logout session purge, Aurion/Wi-Fi outage banner, offline SW cache, and Sentry 11
    critical Logout or upstream degradation
      U->>R: trigger mauria:logout
      R->>H: clearSessionScopedCaches() aborts in-flight requests, purges credentials & warmState across tabs
    option Upstream outage (/badjunia/status)
      A-->>H: /badjunia/status reports aurionDown or wifiDown (fresh for 5 min via isStale)
      R-->>U: blinking ServerCrash header indicator + expandable JuniaStatusWarning banner
    option Network offline or uncaught render error
      S-->>U: Service Worker serves build-hashed cached shell and static assets offline
      R->>S: ErrorBoundary lazy-imports @sentry/react 11 (dataCollection off, 0 PII) & shows recovery UI
    end
  end
```

| Step | Command | Notes |
| --- | --- | --- |
| Configure | <pre lang="sh">export VITE_API_URL=https://mauria-api.fly.dev</pre> | optional; defaults to `https://mauria-api.fly.dev` in [`src/lib/api/helper.ts`](src/lib/api/helper.ts) |
| Install | <pre lang="sh">pnpm install --frozen-lockfile</pre> | Node 24+ and `pnpm` 12+ (`15` prod dependencies, `17` dev dependencies) |
| Develop | <pre lang="sh">pnpm run dev</pre> | starts Vite 8 dev server on `http://localhost:5173` (includes `/dev/planning-preview` fixture route) |
| Typecheck | <pre lang="sh">pnpm exec tsc -b</pre> | TypeScript 7.0 strict project-references check across `tsconfig.app.json` and `tsconfig.node.json` |
| Lint | <pre lang="sh">pnpm run lint</pre> | ESLint 10 flat config + React 19 Compiler (`eslint-plugin-react-hooks` 7) + `eslint-plugin-i18next` |
| Build | <pre lang="sh">pnpm run build</pre> | runs `tsc -b && vite build` (Rolldown + Oxc `es2024`), stamps `dist/sw.js` with `mauria-<sha256>`, and pre-compresses `93` assets (`1,673.0 kB` raw -> `443.9 kB` `.br` / `506.5 kB` `.gz`) |
| Preview | <pre lang="sh">pnpm run preview</pre> | serves production `dist/` bundle locally |
| Container | <pre lang="sh">docker build --platform linux/amd64 -t mauria-webapp .&#10;docker run -p 8080:80 mauria-webapp</pre> | `alpine:3.22` + `nginx` + `ngx_http_brotli_static_module`, non-root `nginx` user, `Link` modulepreload + CSP headers, `/healthz` probe |
| Deploy | <pre lang="sh">fly deploy --remote-only</pre> | deploys to Fly.io (`cdg` region, `256 MB` RAM, `1` shared CPU, `auto_stop_machines = 'suspend'`, `GET /healthz` every `15 s`) |
