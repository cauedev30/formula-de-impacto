import assert from "node:assert/strict";
import test from "node:test";

// A fila mora no localStorage, que não existe no Node. O dublê é um Map com a mesma
// superfície; testar contra ele vale porque o módulo só usa getItem e setItem.
const armazem = new Map();
globalThis.localStorage = {
  getItem: (chave) => armazem.get(chave) ?? null,
  setItem: (chave, valor) => armazem.set(chave, valor),
};

const ouvintes = new Map();
globalThis.window = {
  addEventListener: (evento, fn) => ouvintes.set(evento, [...(ouvintes.get(evento) ?? []), fn]),
  removeEventListener: (evento, fn) =>
    ouvintes.set(evento, (ouvintes.get(evento) ?? []).filter((f) => f !== fn)),
};
// O Node 22 já traz um `navigator` só de leitura, então atribuir direto estoura
// "Cannot set property navigator of #<Object> which has only a getter".
let temRede = true;
Object.defineProperty(globalThis, "navigator", { value: { get onLine() { return temRede; } }, configurable: true });
const disparar = (evento) => (ouvintes.get(evento) ?? []).forEach((fn) => fn());

const { aoVoltarOnline, desenfileirar, enfileirar, juntarTranscricao, pendentes, semTranscricaoAntiga, transcrever } = await import(
  "../lib/transcrever.mjs"
);

const servidorResponde = (status, corpo) => {
  globalThis.fetch = async () => new Response(JSON.stringify(corpo), { status });
};
const erroDe = (promessa) => promessa.then(() => assert.fail("devia falhar"), (erro) => erro);

test("áudio gravado sem sinal fica anotado com a entrevista e a pergunta de origem", () => {
  armazem.clear();
  enfileirar("e1", "p1", "a1");
  assert.deepEqual(pendentes(), [{ entrevistaId: "e1", perguntaId: "p1", audioId: "a1" }]);
});

test("regravar a mesma resposta não deixa duas pendências do mesmo áudio", () => {
  armazem.clear();
  enfileirar("e1", "p1", "a1");
  enfileirar("e1", "p1", "a1");
  enfileirar("e1", "p2", "a2");
  assert.equal(pendentes().length, 2);
});

test("transcrever tira da fila só o áudio transcrito", () => {
  armazem.clear();
  enfileirar("e1", "p1", "a1");
  enfileirar("e1", "p2", "a2");
  desenfileirar("a1");
  assert.deepEqual(pendentes().map((i) => i.audioId), ["a2"]);
});

test("fila corrompida no armazenamento devolve vazio em vez de derrubar a tela", () => {
  armazem.clear();
  armazem.set("transcricoes-pendentes", "{isso não é json");
  assert.deepEqual(pendentes(), []);
});

test("a volta da rede dispara a transcrição sem o entrevistador pedir", () => {
  let rodou = 0;
  temRede = true;
  const soltar = aoVoltarOnline(() => rodou++);
  disparar("online");
  assert.equal(rodou, 1);
  soltar();
  disparar("online");
  assert.equal(rodou, 1, "depois de soltar, o ouvinte não pode continuar rodando");
});

test("evento online com o aparelho ainda sem rede não tenta transcrever", () => {
  let rodou = 0;
  temRede = false;
  const soltar = aoVoltarOnline(() => rodou++);
  disparar("online");
  assert.equal(rodou, 0);
  soltar();
});

test("transcrição entra depois do texto digitado, sem apagar o que estava escrito", () => {
  const junto = juntarTranscricao({ audioId: "a1", texto: "anotei à mão" }, "falou do Pronaf");
  assert.equal(junto.texto, "anotei à mão\n\nfalou do Pronaf");
  assert.equal(junto.audioId, "a1");
  assert.ok(junto.transcritoEm);
});

test("transcrição em resposta sem texto vira o próprio texto", () => {
  assert.equal(juntarTranscricao({ audioId: "a1", texto: "  " }, "falou do Pronaf").texto, "falou do Pronaf");
});

test("áudio que o servidor recusa (422) é erro final e não volta para a fila", async () => {
  servidorResponde(422, { erro: "Não saiu texto do áudio." });
  const erro = await erroDe(transcrever(new Blob(["x"])));
  assert.equal(erro.definitivo, true);
  assert.equal(erro.message, "Não saiu texto do áudio.");
});

test("servidor fora (502), limite (429), proxy (403) e rede caída continuam na fila", async () => {
  for (const status of [502, 429, 403, 404]) {
    servidorResponde(status, {});
    assert.equal((await erroDe(transcrever(new Blob(["x"])))).definitivo, false, String(status));
  }
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  assert.ok(!(await erroDe(transcrever(new Blob(["x"])))).definitivo);
});

test("portal de wifi que responde 200 sem texto não vira transcrição", async () => {
  globalThis.fetch = async () => new Response("<html>login</html>", { status: 200 });
  const erro = await erroDe(transcrever(new Blob(["x"])));
  assert.ok(!erro.definitivo);
});

test("regravar tira a transcrição antiga e mantém o que foi digitado", () => {
  const valor = juntarTranscricao({ audioId: "a1", texto: "anotei à mão" }, "falou do Pronaf");
  assert.equal(semTranscricaoAntiga(valor).texto, "anotei à mão");
  assert.equal(semTranscricaoAntiga(valor).transcritoEm, undefined);
});

test("regravar não mexe em transcrição que já foi corrigida", () => {
  const valor = { ...juntarTranscricao({ audioId: "a1" }, "falou do Punaf"), texto: "falou do Pronaf" };
  assert.equal(semTranscricaoAntiga(valor).texto, "falou do Pronaf");
});
