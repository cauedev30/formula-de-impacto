import assert from "node:assert/strict";
import test from "node:test";

import { estaPendente, marcarEnviada, paraEnvio, pendentes } from "../lib/sincronizar.mjs";

const entrevista = (extra) => ({
  id: "e1",
  perfil: { categoria: "agricultor", faixa: "jovem", genero: "masculino" },
  respostas: { nome: "Maria" },
  iniciadaEm: "2026-09-01T10:00:00.000Z",
  concluidaEm: null,
  ...extra,
});

test("entrevista alterada depois do último envio está pendente", () => {
  assert.equal(
    estaPendente(
      entrevista({ alteradaEm: "2026-09-18T12:00:00.000Z", sincronizadaEm: "2026-09-18T11:00:00.000Z" }),
    ),
    true,
  );
});

test("entrevista antiga, sem carimbo nenhum, está pendente", () => {
  assert.equal(estaPendente(entrevista({})), true);
});

test("entrevista já enviada e não mexida depois fica de fora", () => {
  assert.equal(
    estaPendente(
      entrevista({ alteradaEm: "2026-09-18T11:00:00.000Z", sincronizadaEm: "2026-09-18T12:00:00.000Z" }),
    ),
    false,
  );
});

test("entrevista enviada no mesmo instante da alteração fica de fora", () => {
  const instante = "2026-09-18T12:00:00.000Z";
  assert.equal(estaPendente(entrevista({ alteradaEm: instante, sincronizadaEm: instante })), false);
});

test("entrevista apagada no aparelho continua pendente até avisar o servidor", () => {
  assert.equal(
    estaPendente(
      entrevista({
        alteradaEm: "2026-09-18T12:00:00.000Z",
        sincronizadaEm: "2026-09-18T11:00:00.000Z",
        apagadaEm: "2026-09-18T12:00:00.000Z",
      }),
    ),
    true,
  );
});

test("pendentes devolve só as que faltam, na ordem em que foram alteradas", () => {
  const lista = [
    entrevista({ id: "nova", alteradaEm: "2026-09-18T12:00:00.000Z" }),
    entrevista({ id: "enviada", alteradaEm: "2026-09-18T10:00:00.000Z", sincronizadaEm: "2026-09-18T11:00:00.000Z" }),
    entrevista({ id: "antiga", alteradaEm: "2026-09-18T09:00:00.000Z" }),
  ];
  assert.deepEqual(pendentes(lista).map((e) => e.id), ["antiga", "nova"]);
});

test("marcarEnviada anota o envio sem mexer no que foi alterado", () => {
  const antes = entrevista({ alteradaEm: "2026-09-18T12:00:00.000Z" });
  const depois = marcarEnviada(antes, "2026-09-18T12:00:05.000Z");
  assert.equal(depois.sincronizadaEm, "2026-09-18T12:00:05.000Z");
  assert.equal(depois.alteradaEm, "2026-09-18T12:00:00.000Z");
  assert.equal(estaPendente(depois), false);
});

test("o que sobe não leva o carimbo de envio, que é assunto do aparelho", () => {
  const dados = paraEnvio(entrevista({ alteradaEm: "2026-09-18T12:00:00.000Z", sincronizadaEm: "x" }));
  assert.equal(dados.sincronizadaEm, undefined);
  assert.equal(dados.id, "e1");
  assert.equal(dados.respostas.nome, "Maria");
});
