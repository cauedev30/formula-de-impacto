import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LEIAME, consolidar, montarCsv } from "../lib/exportar.mjs";
import { EXTENSOES } from "../lib/formatos-audio.mjs";

const banco = JSON.parse(readFileSync(new URL("../data/perguntas.json", import.meta.url)));

const entrevista = (id, perfil, respostas) => ({
  id,
  perfil,
  respostas,
  iniciadaEm: "2026-09-04T12:00:00.000Z",
  concluidaEm: null,
});

const jovem = { categoria: "agricultor", faixa: "jovem", genero: "masculino" };
const adulta = { categoria: "assentado", faixa: "adulto", genero: "feminino" };

test("CSV traz uma linha por entrevista mais o cabeçalho", () => {
  const csv = montarCsv(banco, [
    entrevista("a", jovem, { nome: "João" }),
    entrevista("b", adulta, { nome: "Maria" }),
  ]);
  assert.equal(csv.split("\r\n").length, 3);
  assert.ok(csv.startsWith('"id","data","categoria"'));
});

test("CSV escapa aspas e junta múltipla escolha numa célula só", () => {
  const csv = montarCsv(banco, [
    entrevista("a", jovem, { nome: 'Zé "do Sítio"', maiores_faltas: ["Água", "Estrada"] }),
  ]);
  assert.ok(csv.includes('"Zé ""do Sítio"""'));
  assert.ok(csv.includes('"Água | Estrada"'));
});

test("CSV marca resposta gravada como áudio e não despeja o objeto", () => {
  const csv = montarCsv(banco, [entrevista("a", jovem, { jovem_uma_mudanca: { audioId: "x1" } })]);
  assert.ok(csv.includes('"[áudio]"'));
  assert.ok(!csv.includes("audioId"));
});

test("CSV prefere o texto digitado quando existe junto do áudio", () => {
  const csv = montarCsv(banco, [
    entrevista("a", jovem, { jovem_uma_mudanca: { audioId: "x1", texto: "Queria internet" } }),
  ]);
  assert.ok(csv.includes('"Queria internet"'));
});

test("CSV tem uma coluna por pergunta do banco, para todo perfil caber na mesma planilha", () => {
  const [cabecalho] = montarCsv(banco, []).split("\r\n");
  const colunas = cabecalho.split('","').length;
  assert.equal(colunas, banco.perguntas.length + 7);
});

test("consolidado conta cada opção e ignora quem nunca recebeu a pergunta", () => {
  const linhas = consolidar(banco, [
    entrevista("a", jovem, { escoamento: "Só uma parte" }),
    entrevista("b", adulta, { escoamento: "Só uma parte" }),
    entrevista("c", { categoria: "poder_publico", cargo: "prefeito", faixa: "adulto" }, {}),
  ]);
  const escoamento = linhas.find((l) => l.pergunta.id === "escoamento");
  assert.equal(escoamento.alcance, 2, "prefeito não responde escoamento");
  assert.equal(escoamento.contagem.find((c) => c.opcao === "Só uma parte").total, 2);
  assert.equal(escoamento.contagem.find((c) => c.opcao === "Sim, toda").total, 0);
});

test("consolidado soma cada opção marcada numa múltipla escolha", () => {
  const linhas = consolidar(banco, [
    entrevista("a", jovem, { maiores_faltas: ["Água", "Estrada"] }),
    entrevista("b", jovem, { maiores_faltas: ["Água"] }),
  ]);
  const faltas = linhas.find((l) => l.pergunta.id === "maiores_faltas").contagem;
  assert.equal(faltas.find((c) => c.opcao === "Água").total, 2);
  assert.equal(faltas.find((c) => c.opcao === "Estrada").total, 1);
  assert.equal(faltas.find((c) => c.opcao === "Saúde").total, 0);
});

test("consolidado não mostra pergunta condicional que não abriu para ninguém", () => {
  const linhas = consolidar(banco, [entrevista("a", jovem, { escoamento: "Sim, toda" })]);
  assert.ok(!linhas.some((l) => l.pergunta.id === "escoamento_obstaculo"));
});

test("consolidado deixa de fora pergunta aberta, que não tem o que contar", () => {
  const linhas = consolidar(banco, [entrevista("a", jovem, { nome: "João" })]);
  assert.ok(!linhas.some((l) => l.pergunta.tipo === "texto" || l.pergunta.tipo === "audio"));
});

test("consolidado sem entrevista nenhuma devolve lista vazia em vez de quebrar", () => {
  assert.deepEqual(consolidar(banco, []), []);
});

test("as instruções do ZIP varrem toda extensão que o gravador produz", () => {
  for (const extensao of EXTENSOES) {
    assert.ok(
      LEIAME.includes(`audios/*/*.${extensao}`),
      `o comando do LEIAME não varre .${extensao}, que é o que o Safari ou o Chrome gravam`,
    );
  }
});
