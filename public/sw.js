const CACHE = "mauria-__BUILD_HASH__";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.webp"];
const ASSET = /^\/(?:assets|sounds|icons)\/|^\/icon\.(?:webp|svg)$/;
const HTML = /text\/html/;

let opening;
const bucket = () => (opening ??= caches.open(CACHE).catch((error) => { opening = undefined; throw error; }));
const put = async (request, response) => { try { await (await bucket()).put(request, response); } catch { } };
const shell = () => caches.match("/index.html", { cacheName: CACHE });

const cacheFirst = async (request) => {
    const hit = await caches.match(request, { cacheName: CACHE });
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await put(request, response.clone());
    return response;
};

const navigate = async (event) => {
    const cached = await shell();
    if (!navigator.onLine) return cached ?? Response.error();
    try {
        const response = (await event.preloadResponse) ?? (await fetch(event.request));
        if (!response) return cached ?? Response.error();
        if (response.ok && HTML.test(response.headers.get("content-type") ?? "")) await put("/index.html", response.clone());
        return response;
    } catch { return cached ?? Response.error(); }
};

self.addEventListener("install", (event) => event.waitUntil(bucket().then((cache) => Promise.allSettled(SHELL.map((path) => cache.add(path))))));

self.addEventListener("activate", (event) => event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter((key) => key !== CACHE && key.startsWith("mauria-")).map((key) => caches.delete(key)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
})()));

self.addEventListener("message", (event) => { if (event.data === "SKIP_WAITING") void self.skipWaiting(); });

self.addEventListener("fetch", (event) => {
    const request = event.request, origin = self.location.origin;
    if (request.method !== "GET" || !request.url.startsWith(origin + "/")) return;
    if (request.mode === "navigate") return void event.respondWith(navigate(event));
    if (ASSET.test(request.url.slice(origin.length))) event.respondWith(cacheFirst(request));
});
