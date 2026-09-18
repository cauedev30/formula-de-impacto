import assert from "node:assert/strict";
import test from "node:test";

const armazem = new Map();
globalThis.localStorage = {
  getItem: (chave) => armazem.get(chave) ?? null,
  setItem: (chave, valor) => armazem.set(chave, valor),
};

const { carimbar, idDoAparelho } = await import("../lib/aparelho.mjs");

test("carimbar anota a hora da alteração sem tocar no resto da entrevista", () => {
  const entrevista = { id: "e1", respostas: { nome: "Maria" }, iniciadaEm: "2026-09-01T10:00:00.000Z" };
  const saida = carimbar(entrevista, "2026-09-18T12:00:00.000Z");
  assert.equal(saida.alteradaEm, "2026-09-18T12:00:00.000Z");
  assert.equal(saida.respostas.nome, "Maria");
  assert.equal(saida.iniciadaEm, "2026-09-01T10:00:00.000Z");
});

test("carimbar anota o aparelho de origem uma vez e não troca depois", () => {
  armazem.clear();
  const primeira = carimbar({ id: "e1" }, "2026-09-18T12:00:00.000Z");
  const segunda = carimbar({ id: "e2" }, "2026-09-18T12:01:00.000Z");
  assert.ok(primeira.aparelhoId);
  assert.equal(primeira.aparelhoId, segunda.aparelhoId);
});

test("entrevista que já veio de outro aparelho mantém a origem dela", () => {
  armazem.clear();
  const saida = carimbar({ id: "e1", aparelhoId: "tablet-antigo" }, "2026-09-18T12:00:00.000Z");
  assert.equal(saida.aparelhoId, "tablet-antigo");
});

test("id do aparelho sobrevive a leituras repetidas", () => {
  armazem.clear();
  assert.equal(idDoAparelho(), idDoAparelho());
});

test("armazenamento bloqueado não derruba o carimbo", () => {
  armazem.clear();
  globalThis.localStorage.setItem = () => {
    throw new Error("cota");
  };
  const saida = carimbar({ id: "e1" }, "2026-09-18T12:00:00.000Z");
  assert.equal(saida.alteradaEm, "2026-09-18T12:00:00.000Z");
  globalThis.localStorage.setItem = (chave, valor) => armazem.set(chave, valor);
});
