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

const { aoVoltarOnline, desenfileirar, enfileirar, pendentes } = await import("../lib/transcrever.mjs");

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
