/** @type {import('next').NextConfig} */
export default {
  output: "export",
  // Sem isto o export gera /entrevista.html e o roteador do cliente procura /entrevista/:
  // a rota nao casa e a pagina nao monta quando a URL traz query string.
  trailingSlash: true,
  images: { unoptimized: true },
};
