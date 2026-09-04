const CACHE = "formula-de-impacto-v3";
const ROTAS = ["/", "/entrevista/", "/relatorio/", "/consolidado/", "/manifest.webmanifest"];

// Uma rota por vez, e falha de uma não derruba as outras: `addAll` é tudo-ou-nada, então
// uma única URL renomeada deixaria o app sem service worker nenhum, sem erro visível.
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

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Navegação nunca pode terminar em tela de erro: sem rede e sem a rota no cache,
  // a home responde e o app continua de pé — é onde o entrevistador está, no meio do mato.
  if (request.mode === "navigate") {
    evento.respondWith(
      caches
        .match(request, { ignoreSearch: true })
        .then((achado) => achado ?? fetch(request))
        .catch(() => caches.match("/")),
    );
    return;
  }

  evento.respondWith(
    caches.match(request).then(
      (achado) =>
        achado ??
        fetch(request).then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copia));
          }
          return resposta;
        }),
    ),
  );
});
