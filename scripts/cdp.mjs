// Ligação com o Chrome pelo protocolo cru, sem Playwright: a bateria de usabilidade e a
// funcional precisam do mesmo encanamento, e uma dependência de navegador inteiro para
// isso custa mais para manter do que as trinta linhas abaixo.

export async function conectar(porta = 9222) {
  const alvo = await (await fetch(`http://localhost:${porta}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let seq = 0;
  const pendentes = new Map();
  const ouvintes = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method) return (ouvintes.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
    const resolver = pendentes.get(msg.id);
    if (!resolver) return;
    pendentes.delete(msg.id);
    resolver(msg.error ? { erro: msg.error } : msg.result);
  };

  const cdp = (metodo, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq;
      pendentes.set(id, resolve);
      ws.send(JSON.stringify({ id, method: metodo, params }));
    });

  const escutar = (evento, fn) => ouvintes.set(evento, [...(ouvintes.get(evento) ?? []), fn]);

  const js = async (expressao) => {
    const r = await cdp("Runtime.evaluate", {
      expression: `(async () => { ${expressao} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "erro no page script");
    return r?.result?.value;
  };

  return { cdp, js, escutar, fechar: () => ws.close() };
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function comandos(js) {
  const clicar = (texto) =>
    js(`
      const alvo = [...document.querySelectorAll("button, a")].find((b) => b.textContent.trim() === ${JSON.stringify(texto)});
      if (!alvo) return false;
      alvo.click();
      return true;
    `);

  // React ignora atribuição direta em `value`: o setter do protótipo é o que dispara o
  // rastreador interno dele, e sem isso o estado do componente nunca vê o que foi digitado.
  const digitarEm = (seletor, valor) =>
    js(`
      const campo = document.querySelector(${JSON.stringify(seletor)});
      if (!campo) return false;
      const proto = campo.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(campo, ${JSON.stringify(valor)});
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    `);

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

  // Passa pela tranca criando o acesso pela própria tela, não escrevendo no localStorage:
  // burlar aqui deixaria a tela de entrada sem medição nenhuma.
  const passarPelaTranca = async (pin = "1234") => {
    if (!(await js(`return Boolean(document.querySelector("#pin"));`))) return "destrancado";
    const cadastro = await js(`return Boolean(document.querySelector("#nome"));`);
    if (cadastro) {
      await digitarEm("#nome", "Entrevistador de Teste");
      await digitarEm("#pin", pin);
      await digitarEm("#confirmacao", pin);
      await clicar("Criar acesso");
    } else {
      await digitarEm("#pin", pin);
      await clicar("Entrar");
    }
    await espera(1400);
    return cadastro ? "acesso criado" : "entrou";
  };

  const limparAparelho = async () => {
    // `deleteDatabase` fica pendente enquanto houver conexão aberta, então os registros
    // são limpos dentro de uma transação, que sempre conclui.
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
  };

  return { clicar, digitarEm, preencher, passarPelaTranca, limparAparelho };
}
