// A pergunta que este script responde: com a chave que vai embutida no build, alguém alcança
// dado que não é dele? Roda contra o Supabase de verdade, com duas contas de teste.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   CONTA_A=a@teste.local SENHA_A=... CONTA_B=b@teste.local SENHA_B=... \
//   npm run validar:rls
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.CONTA_A, senha: process.env.SENHA_A };
const B = { email: process.env.CONTA_B, senha: process.env.SENHA_B };

if (!URL || !ANON || !A.email || !B.email) {
  console.error("faltam SUPABASE_URL, SUPABASE_ANON_KEY, CONTA_A/SENHA_A e CONTA_B/SENHA_B");
  process.exit(1);
}

const resultados = [];
const checar = (nome, ok, detalhe = "") => {
  resultados.push(ok);
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

const entrar = async ({ email, senha }) => {
  const cliente = createClient(URL, ANON);
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login de ${email} falhou: ${error.message}`);
  return cliente;
};

const entrevista = (id, quando) => ({
  id,
  perfil: { categoria: "agricultor", faixa: "jovem", genero: "masculino" },
  respostas: { nome: "Teste" },
  iniciadaEm: quando,
  concluidaEm: null,
  alteradaEm: quando,
  aparelhoId: "tablet-de-teste",
});

const clienteA = await entrar(A);
const clienteB = await entrar(B);

// A grava uma entrevista.
const idA = `rls-a-${Date.now()}`;
const gravou = await clienteA.rpc("receber_entrevista", {
  dados: entrevista(idA, "2026-09-18T12:00:00.000Z"),
});
checar("entrevistador grava a própria entrevista", !gravou.error, gravou.error?.message ?? "");

// B não pode ver.
const leuDeA = await clienteB.from("entrevistas").select("id").eq("id", idA);
checar("entrevistador B não lê a entrevista de A", (leuDeA.data ?? []).length === 0);

// Sem sessão não lê nada.
const anonimo = createClient(URL, ANON);
const semSessao = await anonimo.from("entrevistas").select("id").limit(1);
checar("sem sessão não lê entrevista nenhuma", (semSessao.data ?? []).length === 0);

// B não pode sobrescrever a entrevista de A, nem com carimbo mais novo.
await clienteB.rpc("receber_entrevista", { dados: entrevista(idA, "2027-01-01T00:00:00.000Z") });
const depois = await clienteA.from("entrevistas").select("respostas").eq("id", idA).single();
checar("entrevistador B não sobrescreve a entrevista de A", !!depois.data);

// Versão mais velha não vence.
await clienteA.rpc("receber_entrevista", {
  dados: { ...entrevista(idA, "2026-09-18T11:00:00.000Z"), respostas: { nome: "MAIS VELHA" } },
});
const atual = await clienteA.from("entrevistas").select("respostas").eq("id", idA).single();
checar("versão mais velha não sobrescreve a mais nova", atual.data?.respostas?.nome === "Teste");

// Escrita direta na tabela é negada.
const direto = await clienteA
  .from("entrevistas")
  .insert({ id: `direto-${Date.now()}`, perfil: {}, alterada_em: new Date().toISOString() });
checar("insert direto na tabela é negado", !!direto.error);

// Storage fora da própria pasta é negado.
const foraDaPasta = await clienteB.storage.from("audios").upload(`${idA}/x/y.ogg`, new Blob(["x"]));
checar("upload fora da própria pasta é negado", !!foraDaPasta.error);

const falhas = resultados.filter((ok) => !ok).length;
console.log(
  `\n${resultados.length} verificações · ${resultados.length - falhas} passaram · ${falhas} falharam`,
);
process.exit(falhas ? 1 : 0);
