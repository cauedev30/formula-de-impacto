"use client";

import { useEffect, useMemo, useState } from "react";

import Icone from "@/components/Icone";
import Topo from "@/components/Topo";
import banco from "@/data/perguntas.json";
import { listarEntrevistas } from "@/lib/db.mjs";
import { consolidar } from "@/lib/exportar.mjs";
import { CATEGORIAS, FAIXAS, descreverPerfil } from "@/lib/rotulos.mjs";

const FILTROS = [
  { valor: "", rotulo: "Todos" },
  ...CATEGORIAS.map((c) => ({ valor: `categoria:${c.valor}`, rotulo: c.rotulo })),
  ...FAIXAS.map((f) => ({ valor: `faixa:${f.valor}`, rotulo: f.rotulo })),
];

export default function Consolidado() {
  const [entrevistas, setEntrevistas] = useState([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    listarEntrevistas().then(setEntrevistas);
  }, []);

  const recorte = useMemo(() => {
    if (!filtro) return entrevistas;
    const [eixo, valor] = filtro.split(":");
    return entrevistas.filter((e) => e.perfil[eixo] === valor);
  }, [entrevistas, filtro]);

  const linhas = useMemo(() => consolidar(banco, recorte), [recorte]);

  return (
    <>
      <Topo titulo="Consolidado" voltar="/" />
      <div className="folha">
        <main className="conteudo">
        <div className="cartao">
          <p className="enunciado" style={{ marginBottom: 12 }}>
            {recorte.length} entrevista(s) neste recorte
          </p>
          <div className="opcoes nao-imprime">
            {FILTROS.map((item) => (
              <button
                key={item.valor}
                type="button"
                className="opcao"
                aria-pressed={filtro === item.valor}
                onClick={() => setFiltro(item.valor)}
              >
                <span className="marcador redondo" aria-hidden="true" />
                <span>{item.rotulo}</span>
              </button>
            ))}
          </div>
        </div>

        {recorte.length === 0 && <p className="aviso">Nenhuma entrevista neste recorte ainda.</p>}

        {linhas.map(({ pergunta, alcance, contagem }) => {
          const maior = Math.max(1, ...contagem.map((c) => c.total));
          return (
            <div key={pergunta.id} className="cartao">
              <p className="enunciado" style={{ fontSize: 18, marginBottom: 4 }}>
                {pergunta.texto}
              </p>
              <p className="discreto" style={{ margin: "0 0 12px" }}>
                {pergunta.secao} · perguntada a {alcance} de {recorte.length}
              </p>
              <table>
                <tbody>
                  {contagem.map(({ opcao, total }) => (
                    <tr key={opcao}>
                      <td style={{ width: "42%" }}>{opcao}</td>
                      <td>
                        <div className="trilho dados">
                          <span style={{ width: `${(total / maior) * 100}%` }} />
                        </div>
                      </td>
                      <td className="n">
                        {total}
                        <span className="discreto">
                          {" "}
                          ({alcance ? Math.round((total / alcance) * 100) : 0}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {recorte.length > 0 && (
          <div className="cartao">
            <h2 className="secao" style={{ marginTop: 0 }}>
              Entrevistados
            </h2>
            <ul style={{ margin: "12px 0 0", paddingLeft: 22 }}>
              {recorte.map((e) => (
                <li key={e.id}>
                  {e.respostas.nome || "Sem nome"} — <span className="discreto">{descreverPerfil(e.perfil)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        </main>
      </div>

      <div className="rodape nao-imprime">
        <button type="button" className="botao" onClick={() => window.print()}>
          <Icone nome="imprimir" />
          Salvar em PDF
        </button>
      </div>
    </>
  );
}
