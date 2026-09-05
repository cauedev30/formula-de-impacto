import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { agruparPorSecao, limparOrfas, montarFormulario, progresso, respondida } from "../lib/montar-formulario.mjs";

const banco = JSON.parse(readFileSync(new URL("../data/perguntas.json", import.meta.url)));
const ids = (perfil, respostas) => montarFormulario(banco, perfil, respostas).map((p) => p.id);

const agricultorJovem = { categoria: "agricultor", faixa: "jovem", genero: "masculino" };
const prefeito = { categoria: "poder_publico", cargo: "prefeito", faixa: "adulto", genero: "masculino" };

test("agricultor jovem recebe a pergunta de permanência no campo", () => {
  assert.ok(ids(agricultorJovem).includes("jovem_permanencia"));
});

test("prefeito não recebe pergunta de juventude nem de produção", () => {
  const doPrefeito = ids(prefeito);
  assert.ok(!doPrefeito.includes("jovem_permanencia"));
  assert.ok(!doPrefeito.includes("escoamento"));
  assert.ok(doPrefeito.includes("gestao_politica_rural"));
});

test("pergunta sem tag `quando` vai para todo perfil", () => {
  for (const perfil of [agricultorJovem, prefeito]) {
    assert.ok(ids(perfil).includes("qualidade_de_vida"), JSON.stringify(perfil));
  }
});

test("condicional de escoamento só abre quando a produção não escoa toda", () => {
  assert.ok(!ids(agricultorJovem, { escoamento: "Sim, toda" }).includes("escoamento_obstaculo"));
  assert.ok(ids(agricultorJovem, { escoamento: "Só uma parte" }).includes("escoamento_obstaculo"));
});

test("condicional fechada antes de responder a pergunta que a governa", () => {
  assert.ok(!ids(agricultorJovem, {}).includes("escoamento_obstaculo"));
});

test("condicional aceita resposta de múltipla escolha", () => {
  const comVenda = ids(agricultorJovem, { destino_producao: "Só venda" });
  assert.ok(comVenda.includes("canais_venda"));
});

test("mulher assentada recebe o bloco de autonomia; homem não", () => {
  const base = { categoria: "assentado", faixa: "adulto" };
  assert.ok(ids({ ...base, genero: "feminino" }).includes("renda_propria"));
  assert.ok(!ids({ ...base, genero: "masculino" }).includes("renda_propria"));
});

test("todo perfil fica na faixa de 20 a 25 perguntas que o formulário de papel tinha", () => {
  const perfis = [];
  for (const categoria of ["agricultor", "quilombola", "assentado"]) {
    for (const faixa of ["jovem", "adulto"]) {
      for (const genero of ["masculino", "feminino"]) perfis.push({ categoria, faixa, genero });
    }
  }
  const cargos = ["prefeito", "cultura", "administracao", "desenvolvimento_meio_ambiente", "financas"];
  for (const cargo of cargos) {
    perfis.push({ categoria: "poder_publico", cargo, faixa: "adulto", genero: "masculino" });
  }
  for (const perfil of perfis) {
    const total = ids(perfil).length;
    assert.ok(total >= 20 && total <= 25, `${JSON.stringify(perfil)} gerou ${total}`);
  }
});

test("ids do banco são únicos e toda condicional aponta para pergunta existente", () => {
  const todos = banco.perguntas.map((p) => p.id);
  assert.equal(new Set(todos).size, todos.length);
  for (const pergunta of banco.perguntas) {
    if (pergunta.se) assert.ok(todos.includes(pergunta.se.pergunta), pergunta.id);
  }
});

test("toda opção de uma condicional existe na pergunta que a governa", () => {
  for (const pergunta of banco.perguntas.filter((p) => p.se)) {
    const governante = banco.perguntas.find((p) => p.id === pergunta.se.pergunta);
    for (const valor of pergunta.se.responder) {
      assert.ok(governante.opcoes.includes(valor), `${pergunta.id} espera "${valor}"`);
    }
  }
});

test("resposta órfã sai quando a condição que a abriu deixa de valer", () => {
  const respostas = { escoamento: "Só uma parte", escoamento_obstaculo: ["Estrada ruim"] };
  const limpas = limparOrfas(banco, agricultorJovem, { ...respostas, escoamento: "Sim, toda" });
  assert.ok(!("escoamento_obstaculo" in limpas));
  assert.equal(limpas.escoamento, "Sim, toda");
});

test("seções saem agrupadas e na ordem do banco", () => {
  const secoes = agruparPorSecao(montarFormulario(banco, agricultorJovem));
  assert.equal(secoes[0].nome, "Identificação");
  assert.equal(new Set(secoes.map((s) => s.nome)).size, secoes.length);
});

test("progresso conta áudio gravado como resposta e texto vazio como pendência", () => {
  const perguntas = montarFormulario(banco, agricultorJovem);
  assert.deepEqual(progresso(perguntas, {}), { feitas: 0, total: perguntas.length });
  const parcial = { nome: "  ", idade: 19, jovem_uma_mudanca: { audioId: "a1" }, maiores_faltas: [] };
  assert.equal(progresso(perguntas, parcial).feitas, 2);
});

test("resposta aberta só digitada conta como respondida, sem áudio nenhum", () => {
  const pergunta = { id: "melhoria_renda", tipo: "audio" };
  assert.equal(respondida(pergunta, { texto: "Precisaria de estrada melhor." }), true);
  assert.equal(respondida(pergunta, { audioId: "a1" }), true);
  assert.equal(respondida(pergunta, { texto: "   " }), false);
  assert.equal(respondida(pergunta, {}), false);
});

test("progresso conta a pergunta aberta respondida por escrito", () => {
  const perguntas = [
    { id: "melhoria_renda", tipo: "audio" },
    { id: "nome", tipo: "texto" },
  ];
  assert.deepEqual(progresso(perguntas, { melhoria_renda: { texto: "Estrada." } }), { feitas: 1, total: 2 });
});
