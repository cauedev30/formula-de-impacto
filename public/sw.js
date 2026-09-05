const CACHE = "formula-de-impacto-v4";
const ROTAS = ["/", "/entrevista/", "/relatorio/", "/consolidado/", "/manifest.webmanifest"];

// Uma rota por vez: `addAll` é tudo-ou-nada e uma URL renomeada deixaria o app sem SW nenhum.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(ROTAS.map((rota) => cache.add(rota).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

const guardar = (request, resposta) => {
  if (resposta?.ok) {
    const copia = resposta.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copia));
  }
  return resposta;
};

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Nome com hash nunca muda de conteúdo.
  if (request.url.includes("/_next/static/")) {
    evento.respondWith(
      caches.match(request).then((achado) => achado ?? fetch(request).then((r) => guardar(request, r))),
    );
    return;
  }

  // Rede primeiro: cache-first no HTML servia o app shell antigo para sempre, e o aparelho
  // em campo nunca receberia correção. O cache responde quando não há sinal.
  evento.respondWith(
    fetch(request)
      .then((resposta) => guardar(request, resposta))
      .catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((achado) => achado ?? (request.mode === "navigate" ? caches.match("/") : undefined)),
      ),
  );
});
