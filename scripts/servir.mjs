// Serve o export estático como o Cloudflare Pages serve: /entrevista responde entrevista.html.
// Existe para testar o artefato que vai ao ar, não o modo de desenvolvimento.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const RAIZ = process.argv[3] ?? "out";
const PORTA = Number(process.argv[2] ?? 3000);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const resolver = (caminho) => {
  const limpo = normalize(decodeURIComponent(caminho.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  for (const tentativa of [limpo, `${limpo}.html`, join(limpo, "index.html")]) {
    const arquivo = join(RAIZ, tentativa);
    if (existsSync(arquivo) && statSync(arquivo).isFile()) return arquivo;
  }
  return null;
};

createServer((req, res) => {
  const arquivo = resolver(req.url === "/" ? "/index.html" : req.url);
  if (!arquivo) {
    res.writeHead(404, { "content-type": TIPOS[".html"] });
    return res.end("404");
  }
  res.writeHead(200, {
    "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream",
    // Sem cache do servidor: o service worker é quem deve decidir o que fica guardado,
    // e cache do navegador aqui esconderia justamente o que a bateria precisa medir.
    "cache-control": "no-store",
  });
  createReadStream(arquivo).pipe(res);
}).listen(PORTA, () => console.log(`servindo ${RAIZ}/ em http://localhost:${PORTA}`));
