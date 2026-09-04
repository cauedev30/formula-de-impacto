"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Icone from "@/components/Icone";
import Topo from "@/components/Topo";
import banco from "@/data/perguntas.json";
import { apagarEntrevista, listarEntrevistas, novoId, salvarEntrevista } from "@/lib/db.mjs";
import { baixar, montarZip } from "@/lib/exportar.mjs";
import { montarFormulario, progresso } from "@/lib/montar-formulario.mjs";
import { CARGOS, CATEGORIAS, FAIXAS, GENEROS, descreverPerfil } from "@/lib/rotulos.mjs";

function Escolha({ titulo, itens, valor, aoEscolher }) {
  return (
    <div className="cartao">
      <p className="enunciado">{titulo}</p>
      <div className="opcoes">
        {itens.map((item) => (
          <button
            key={item.valor}
            type="button"
            className="opcao"
            aria-pressed={valor === item.valor}
            onClick={() => aoEscolher(item.valor)}
          >
            <span className="marcador redondo" aria-hidden="true" />
            <span>{item.rotulo}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Inicio() {
  const router = useRouter();
  const [perfil, setPerfil] = useState({});
  const [entrevistas, setEntrevistas] = useState([]);
  const [exportando, setExportando] = useState(false);
  const [paraApagar, setParaApagar] = useState(null);

  useEffect(() => {
    listarEntrevistas().then(setEntrevistas);
    // Baixa o código das outras telas enquanto ainda há sinal. O service worker só guarda
    // o que passou pela rede: sem isto, abrir a entrevista offline cai numa rota sem chunk.
    for (const rota of ["/entrevista/", "/relatorio/", "/consolidado/"]) router.prefetch(rota);
  }, [router]);

  const publico = perfil.categoria === "poder_publico";
  const completo = publico
    ? Boolean(perfil.cargo)
    : Boolean(perfil.categoria && perfil.faixa && perfil.genero);

  async function comecar() {
    // O poder público entra sempre como adulto: o banco usa a faixa para abrir o bloco de
    // juventude, e secretário não responde pergunta de permanência no campo.
    const escolhido = publico ? { ...perfil, faixa: "adulto", genero: perfil.genero ?? "masculino" } : perfil;
    let entrevistador = "";
    try {
      entrevistador = JSON.parse(localStorage.getItem("acesso-formula-impacto") || "{}").nome || "";
    } catch {
      entrevistador = "";
    }
    const entrevista = {
      id: novoId(),
      perfil: escolhido,
      entrevistador,
      respostas: {},
      iniciadaEm: new Date().toISOString(),
      concluidaEm: null,
    };
    await salvarEntrevista(entrevista);
    router.push(`/entrevista/?id=${entrevista.id}`);
  }

  async function apagar(id) {
    await apagarEntrevista(id);
    setParaApagar(null);
    setEntrevistas(await listarEntrevistas());
  }

  async function exportar() {
    setExportando(true);
    try {
      const { blob, total } = await montarZip(banco);
      baixar(blob, `entrevistas-${new Date().toISOString().slice(0, 10)}-${total}.zip`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <Topo
        titulo={
          <>
            <b>CAIXA</b> Fórmula de Impacto
          </>
        }
      />
      {entrevistas.length === 0 && !perfil.categoria && (
        <div className="marca-abertura">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="CAIXA Fórmula de Impacto" width={196} height={248} />
          <p className="promessa">Funciona sem sinal. As entrevistas ficam guardadas neste aparelho.</p>
        </div>
      )}

      <div className="folha">
        <main className="conteudo">
        <Escolha
          titulo="Quem você vai entrevistar?"
          itens={CATEGORIAS}
          valor={perfil.categoria}
          aoEscolher={(categoria) => setPerfil({ categoria })}
        />

        {publico && (
          <Escolha
            titulo="Qual pasta?"
            itens={CARGOS}
            valor={perfil.cargo}
            aoEscolher={(cargo) => setPerfil((p) => ({ ...p, cargo }))}
          />
        )}

        {perfil.categoria && !publico && (
          <>
            <Escolha
              titulo="Faixa etária"
              itens={FAIXAS}
              valor={perfil.faixa}
              aoEscolher={(faixa) => setPerfil((p) => ({ ...p, faixa }))}
            />
            <Escolha
              titulo="Gênero"
              itens={GENEROS}
              valor={perfil.genero}
              aoEscolher={(genero) => setPerfil((p) => ({ ...p, genero }))}
            />
          </>
        )}

        {completo && (
          <p className="selo">
            {montarFormulario(banco, publico ? { ...perfil, faixa: "adulto" } : perfil).length} perguntas
            para este perfil
          </p>
        )}

        {entrevistas.length > 0 && (
          <>
            <h2 className="secao">Entrevistas no aparelho ({entrevistas.length})</h2>
            <ul className="lista">
              {entrevistas.map((entrevista) => {
                const perguntas = montarFormulario(banco, entrevista.perfil, entrevista.respostas);
                const { feitas, total } = progresso(perguntas, entrevista.respostas);
                const armado = paraApagar === entrevista.id;
                return (
                  <li key={entrevista.id} className="item">
                    <Link href={`/entrevista/?id=${entrevista.id}`}>
                      <span>
                        <strong>{entrevista.respostas.nome || "Sem nome"}</strong>
                        <br />
                        <span className="discreto">{descreverPerfil(entrevista.perfil)}</span>
                      </span>
                      <span className="discreto">
                        {feitas}/{total}
                      </span>
                    </Link>
                    <div className="acoes">
                      <Link href={`/entrevista/?id=${entrevista.id}`}>Continuar</Link>
                      <Link href={`/relatorio/?id=${entrevista.id}`}>Ficha</Link>
                      <button
                        type="button"
                        className="perigo"
                        data-armado={armado}
                        onClick={() => (armado ? apagar(entrevista.id) : setParaApagar(entrevista.id))}
                        onBlur={() => armado && setParaApagar(null)}
                      >
                        <Icone nome="apagar" tamanho={19} />
                        {armado ? "Apagar mesmo?" : "Apagar"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div style={{ display: "grid", gap: 12 }}>
              <Link href="/consolidado/" className="botao secundario">
                Ver consolidado
              </Link>
              <button type="button" className="botao secundario" onClick={exportar} disabled={exportando}>
                <Icone nome="baixar" />
                {exportando ? "Preparando…" : "Exportar tudo (ZIP)"}
              </button>
            </div>
          </>
        )}
        </main>
      </div>

      <div className="rodape">
        <button type="button" className="botao" onClick={comecar} disabled={!completo}>
          Começar entrevista
        </button>
      </div>
    </>
  );
}
