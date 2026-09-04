"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import Icone from "@/components/Icone";
import Resposta from "@/components/Resposta";
import Topo from "@/components/Topo";
import banco from "@/data/perguntas.json";
import { obterEntrevista, salvarEntrevista } from "@/lib/db.mjs";
import {
  agruparPorSecao,
  limparOrfas,
  montarFormulario,
  progresso,
  respondida,
} from "@/lib/montar-formulario.mjs";
import { descreverPerfil } from "@/lib/rotulos.mjs";

export default function Formulario() {
  const router = useRouter();
  const [id, setId] = useState(undefined);
  // `undefined` é "ainda buscando" e `null` é "não existe". Um estado só para os dois
  // deixava a tela em branco para sempre quando o id não estava no aparelho.
  const [entrevista, setEntrevista] = useState(undefined);
  const [salvo, setSalvo] = useState(true);
  const primeiraCarga = useRef(true);

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  useEffect(() => {
    if (id === undefined) return;
    if (id) obterEntrevista(id).then((achada) => setEntrevista(achada ?? null));
    else setEntrevista(null);
  }, [id]);

  // Digitar dispara uma mudança por tecla; agrupar em 400 ms evita uma escrita por letra
  // sem arriscar o dado: qualquer pausa da mão já grava.
  useEffect(() => {
    if (!entrevista) return;
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }
    setSalvo(false);
    const timer = setTimeout(() => salvarEntrevista(entrevista).then(() => setSalvo(true)), 400);
    return () => clearTimeout(timer);
  }, [entrevista]);

  const perguntas = useMemo(
    () => (entrevista ? montarFormulario(banco, entrevista.perfil, entrevista.respostas) : []),
    [entrevista],
  );
  const secoes = useMemo(() => agruparPorSecao(perguntas), [perguntas]);
  const { feitas, total } = progresso(perguntas, entrevista?.respostas ?? {});

  function responder(perguntaId, valor) {
    setEntrevista((atual) => {
      const respostas = { ...atual.respostas };
      if (valor === undefined || valor === "") delete respostas[perguntaId];
      else respostas[perguntaId] = valor;
      return { ...atual, respostas: limparOrfas(banco, atual.perfil, respostas) };
    });
  }

  async function concluir() {
    const concluida = { ...entrevista, concluidaEm: new Date().toISOString() };
    await salvarEntrevista(concluida);
    router.push(`/relatorio/?id=${entrevista.id}`);
  }

  if (entrevista === undefined) return null;

  if (!id || entrevista === null) {
    return (
      <>
        <Topo titulo="Entrevista" voltar="/" />
        <div className="folha">
          <main className="conteudo">
            <p className="aviso">Entrevista não encontrada neste aparelho.</p>
          </main>
        </div>
      </>
    );
  }

  let numero = 0;

  return (
    <>
      <Topo titulo={entrevista.respostas.nome || "Nova entrevista"} voltar="/" />
      <div className="folha">
        <main className="conteudo">
        <p className="discreto" style={{ margin: 0 }}>
          {descreverPerfil(entrevista.perfil)}
        </p>

        {secoes.map((secao) => (
          <section key={secao.nome}>
            <h2 className="secao">{secao.nome}</h2>
            <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
              {secao.perguntas.map((pergunta) => {
                numero += 1;
                const valor = entrevista.respostas[pergunta.id];
                return (
                  <div key={pergunta.id} className="cartao">
                    <p className="enunciado">
                      <span className="numero">{numero}.</span>
                      {pergunta.texto}
                      {respondida(pergunta, valor) && (
                        <span className="selo selo-feito" style={{ marginLeft: 10, verticalAlign: "middle" }}>
                          <Icone nome="feito" tamanho={16} />
                        </span>
                      )}
                    </p>
                    <Resposta
                      pergunta={pergunta}
                      valor={valor}
                      entrevistaId={entrevista.id}
                      aoResponder={responder}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        </main>
      </div>

      <div className="rodape">
        <div style={{ flex: 1 }}>
          <div className="trilho">
            <span style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} />
          </div>
          <p className="discreto" style={{ margin: "6px 0 0" }}>
            {feitas} de {total} · {salvo ? "salvo no aparelho" : "salvando…"}
          </p>
        </div>
        <button type="button" className="botao" onClick={concluir} disabled={feitas === 0}>
          Concluir
        </button>
      </div>
    </>
  );
}
