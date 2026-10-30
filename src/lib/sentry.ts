/**
 * Sentry initialisation.
 *
 * Must be called synchronously before the first render. `Sentry.captureException`
 * is a silent no-op when no client is bound — it returns a plausible event id and
 * captures nothing — so a deferred init means any throw during startup, on the
 * pre-auth routes, or inside an early error boundary is lost without a trace.
 *
 * The SDK is imported statically: it already lives in the entry chunk (Replay and
 * BrowserTracing are eager there too), so making the import synchronous adds no
 * bytes. `replaysSessionSampleRate: 0` keeps Replay idle until an error occurs.
 */
import * as Sentry from "@sentry/react";

const DSN =
    "https://43f1e4d5385f6aac1b8e60ececf90921@o4510087561412608.ingest.us.sentry.io/4510087561740288";

let initialised = false;

export function initSentry(): void {
    if (initialised) return;
    initialised = true;

    Sentry.init({
        dsn: DSN,
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            genAI: { inputs: false, outputs: false },
            databaseQueryData: false,
            graphQL: { document: false, variables: false },
        },
        integrations: [
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
            Sentry.browserTracingIntegration(),
        ],
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        tracesSampleRate: 0.1,
        beforeSend(event) {
            if (event.request) {
                event.request.data = undefined;
                event.request.cookies = undefined;
                event.request.query_string = undefined;
            }
            if (event.user) event.user = { id: event.user.id };
            return event;
        },
        beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.data) {
                delete breadcrumb.data.url;
                delete breadcrumb.data.to;
                delete breadcrumb.data.from;
            }
            return breadcrumb;
        },
    });
}
