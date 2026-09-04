// Bateria de usabilidade cross-device. Precisa do app servido e de um Chrome com CDP aberto:
//   npm run dev
//   npm run test:ui
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CDP_PORT = process.env.CDP_PORT ?? 9222;
const SAIDA = process.env.SAIDA ?? "telas";

// Alvo de 44px é o piso da WCAG 2.5.5 e do HIG; o app mira 56px, mas falhar abaixo de 44
// é o que separa "apertado" de "não dá para acertar com o polegar".
const ALVO_MINIMO = 44;
const FONTE_MINIMA = 14;

const DEVICES = [
  { nome: "galaxy-a-360", largura: 360, altura: 800, escala: 3, movel: true },
  { nome: "iphone-se-375", largura: 375, altura: 667, escala: 2, movel: true },
  { nome: "iphone-15-393", largura: 393, altura: 852, escala: 3, movel: true },
  { nome: "pixel-8-412", largura: 412, altura: 915, escala: 2.625, movel: true },
  { nome: "ipad-mini-744", largura: 744, altura: 1133, escala: 2, movel: true },
  { nome: "tablet-android-800", largura: 800, altura: 1280, escala: 2, movel: true },
  { nome: "ipad-pro-deitado-1194", largura: 1194, altura: 834, escala: 2, movel: true },
];

const alvo = await (await fetch(`http://localhost:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let seq = 0;
const pendentes = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  const resolver = pendentes.get(msg.id);
  if (!resolver) return;
  pendentes.delete(msg.id);
  resolver(msg.error ? { erro: msg.error } : msg.result);
};
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pendentes.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expressao) => {
  const r = await cdp("Runtime.evaluate", {
    expression: `(async () => { ${expressao} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "erro no page script");
  return r?.result?.value;
};

const AUDITORIA = `
  const luminancia = (cor) => {
    const [r, g, b] = cor.match(/[\\d.]+/g).slice(0, 3).map(Number);
    const canal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  };
  const opaco = (cor) => cor && !/rgba\\(.*,\\s*0\\)/.test(cor) && cor !== "transparent";
  const fundoDe = (el) => {
    for (let no = el; no; no = no.parentElement) {
      const bg = getComputedStyle(no).backgroundColor;
      if (opaco(bg)) return bg;
    }
    return "rgb(255, 255, 255)";
  };
  const razao = (frente, fundo) => {
    const [a, b] = [luminancia(frente), luminancia(fundo)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };
  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };

  const achados = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > window.innerWidth + 1) {
    achados.push({ tipo: "scroll-horizontal", detalhe: doc.scrollWidth + "px numa tela de " + window.innerWidth + "px" });
  }

  for (const el of document.querySelectorAll("button, a, input, textarea, select, [role=button]")) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < ${ALVO_MINIMO} || r.width < ${ALVO_MINIMO}) {
      achados.push({
        tipo: "alvo-pequeno",
        detalhe: Math.round(r.width) + "x" + Math.round(r.height) + "px",
        texto: (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40),
      });
    }
    if (r.right > window.innerWidth + 1 || r.left < -1) {
      achados.push({ tipo: "fora-da-tela", texto: (el.textContent || el.tagName).trim().slice(0, 40) });
    }
  }

  const comTexto = [...document.querySelectorAll("p, li, span, strong, button, a, td, th, h1, h2, h3, label")]
    .filter((el) => visivel(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));

  for (const el of comTexto) {
    const s = getComputedStyle(el);
    const tamanho = parseFloat(s.fontSize);
    if (tamanho < ${FONTE_MINIMA}) {
      achados.push({ tipo: "fonte-pequena", detalhe: tamanho + "px", texto: el.textContent.trim().slice(0, 40) });
    }
    const grande = tamanho >= 24 || (tamanho >= 18.66 && Number(s.fontWeight) >= 700);
    const piso = grande ? 3 : 4.5;
    const contraste = razao(s.color, fundoDe(el));
    if (contraste < piso) {
      achados.push({
        tipo: "contraste-baixo",
        detalhe: contraste.toFixed(2) + ":1 (piso " + piso + ")",
        texto: el.textContent.trim().slice(0, 40),
      });
    }
  }

  // Rodape fixo cobre conteudo enquanto se rola, isso e o desenho. O defeito e o que
  // sobra inalcancavel no fim da pagina: por isso a medicao so vale rolado ate o fim.
  const rodape = document.querySelector(".rodape");
  const main = document.querySelector("main");
  if (rodape && main) {
    window.scrollTo(0, doc.scrollHeight);
    await new Promise((r) => setTimeout(r, 260));
    const topoRodape = rodape.getBoundingClientRect().top;
    for (const el of main.querySelectorAll("button, a, input, textarea")) {
      if (!visivel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > topoRodape && r.top < window.innerHeight) {
        achados.push({ tipo: "inalcancavel-no-fim", texto: (el.textContent || el.tagName).trim().slice(0, 40) });
      }
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 160));
  }

  return achados;
`;

const clicar = (texto) =>
  js(`
    const alvo = [...document.querySelectorAll("button, a")].find((b) => b.textContent.trim() === ${JSON.stringify(texto)});
    if (!alvo) return false;
    alvo.click();
    return true;
  `);

// A bateria passa pela tranca criando o acesso pela própria tela, não burlando o localStorage:
// assim a tela de entrada também é medida em todo aparelho.
const digitarEm = (seletor, valor) =>
  js(`
    const campo = document.querySelector(${JSON.stringify(seletor)});
    if (!campo) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, ${JSON.stringify(valor)});
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  `);

const passarPelaTranca = async () => {
  if (!(await js(`return Boolean(document.querySelector("#pin"));`))) return "destrancado";
  const cadastro = await js(`return Boolean(document.querySelector("#nome"));`);
  if (cadastro) {
    await digitarEm("#nome", "Entrevistador de Teste");
    await digitarEm("#pin", "1234");
    await digitarEm("#confirmacao", "1234");
    await clicar("Criar acesso");
  } else {
    await digitarEm("#pin", "1234");
    await clicar("Entrar");
  }
  await espera(1400);
  return cadastro ? "acesso criado" : "entrou";
};

const preencher = (rotulo, valor) =>
  js(`
    const campo = [...document.querySelectorAll("input, textarea")]
      .find((c) => (c.getAttribute("aria-label") || "").includes(${JSON.stringify(rotulo)}));
    if (!campo) return false;
    const proto = campo.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(campo, ${JSON.stringify(valor)});
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  `);

async function foto(nome) {
  const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(`${SAIDA}/${nome}.png`, Buffer.from(data, "base64"));
}

const problemas = [];
const registrar = (device, tela, achados) => {
  for (const achado of achados ?? []) problemas.push({ device: device.nome, tela, ...achado });
};

mkdirSync(SAIDA, { recursive: true });
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
// A bateria mede o build atual, não o que o service worker guardou de uma rodada anterior.
await cdp("Network.setBypassServiceWorker", { bypass: true });

for (const device of DEVICES) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: device.largura,
    height: device.altura,
    deviceScaleFactor: 1,
    mobile: device.movel,
  });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  await cdp("Page.navigate", { url: BASE });
  await espera(2200);
  // Cada aparelho começa do zero. `deleteDatabase` fica pendente enquanto houver conexão
  // aberta, então limpamos os registros dentro de uma transação, que sempre conclui.
  await js(`
    return new Promise((res) => {
      const abrir = indexedDB.open("entrevista-campo");
      abrir.onsuccess = () => {
        const db = abrir.result;
        const nomes = [...db.objectStoreNames];
        if (!nomes.length) return res(true);
        const tx = db.transaction(nomes, "readwrite");
        nomes.forEach((n) => tx.objectStore(n).clear());
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      };
      abrir.onerror = () => res(false);
      setTimeout(() => res("timeout"), 4000);
    });
  `);
  await js(`localStorage.clear(); sessionStorage.clear(); return true;`);
  await cdp("Page.reload");
  await espera(2200);

  registrar(device, "tranca", await js(AUDITORIA));
  await foto(`${device.nome}-0-tranca`);
  await passarPelaTranca();

  registrar(device, "inicio", await js(AUDITORIA));
  await foto(`${device.nome}-1-inicio`);

  for (const rotulo of ["Agricultor(a) familiar", "Jovem (até 29 anos)", "Mulher"]) {
    if (!(await clicar(rotulo))) problemas.push({ device: device.nome, tela: "inicio", tipo: "botao-sumido", texto: rotulo });
    await espera(320);
  }
  registrar(device, "perfil-escolhido", await js(AUDITORIA));
  await foto(`${device.nome}-2-perfil`);

  await clicar("Começar entrevista");
  await espera(2000);

  await preencher("Nome do entrevistado", "Maria das Graças Silva");
  await preencher("Comunidade", "Sítio Bom Jardim");
  await preencher("Idade", "19");
  await espera(700);
  for (const rotulo of ["Nasci aqui", "Regular", "Água", "Estrada", "Só uma parte"]) {
    await clicar(rotulo);
    await espera(220);
  }
  await espera(900);
  registrar(device, "formulario", await js(AUDITORIA));
  await foto(`${device.nome}-3-formulario`);

  const condicionalAbriu = await js(
    `return document.body.textContent.includes("O que impede escoar a produção");`,
  );
  if (!condicionalAbriu) {
    problemas.push({ device: device.nome, tela: "formulario", tipo: "condicional-nao-abriu", texto: "escoamento_obstaculo" });
  }

  await clicar("Concluir");
  await espera(2000);
  registrar(device, "ficha", await js(AUDITORIA));
  await foto(`${device.nome}-4-ficha`);

  await cdp("Page.navigate", { url: `${BASE}/consolidado` });
  await espera(2000);
  registrar(device, "consolidado", await js(AUDITORIA));
  await foto(`${device.nome}-5-consolidado`);
}

ws.close();

const porTipo = new Map();
for (const p of problemas) {
  const chave = `${p.tipo} · ${p.texto ?? ""} · ${p.detalhe ?? ""}`;
  if (!porTipo.has(chave)) porTipo.set(chave, { ...p, devices: new Set() });
  porTipo.get(chave).devices.add(p.device);
}

console.log(`\n${DEVICES.length} aparelhos · 5 telas cada · telas em ${SAIDA}/\n`);
if (porTipo.size === 0) {
  console.log("nenhum problema de usabilidade encontrado");
} else {
  for (const [, p] of [...porTipo].sort((a, b) => b[1].devices.size - a[1].devices.size)) {
    console.log(
      `${p.tipo.padEnd(22)} ${String(p.detalhe ?? "").padEnd(26)} ${(p.texto ?? "").padEnd(42)} ${[...p.devices].join(", ")}`,
    );
  }
}
process.exit(porTipo.size === 0 ? 0 : 1);
