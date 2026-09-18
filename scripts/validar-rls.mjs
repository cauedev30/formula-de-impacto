// A pergunta que este script responde: com a chave que vai embutida no build, alguém alcança
// dado que não é dele?
//
// Só com a URL e a chave anon ele já roda a metade que não precisa de login — que é
// justamente a que pega a falha catastrófica: RLS desligado deixa a tabela legível para
// qualquer um com a chave, e a chave está dentro do JavaScript do site.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run validar:rls
//
// Com duas contas ele roda também o isolamento entre entrevistadores, que é o que prova que
// um não lê nem sobrescreve o dado do outro:
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   CONTA_A=... SENHA_A=... CONTA_B=... SENHA_B=... npm run validar:rls
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.CONTA_A, senha: process.env.SENHA_A };
const B = { email: process.env.CONTA_B, senha: process.env.SENHA_B };

if (!URL || !ANON) {
  console.error("faltam SUPABASE_URL e SUPABASE_ANON_KEY");
  process.exit(1);
}

const resultados = [];
const checar = (nome, ok, detalhe = "") => {
  resultados.push(ok);
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
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

// Sem login ------------------------------------------------------------------

const anonimo = createClient(URL, ANON);

for (const tabela of ["entrevistas", "entrevistadores", "audios"]) {
  const { data, error } = await anonimo.from(tabela).select("*").limit(1);
  // Erro de permissão também serve: o que não pode é vir linha.
  checar(`sem sessão não lê ${tabela}`, (data ?? []).length === 0, error ? "negado" : "vazio");
}

const escritaAnonima = await anonimo
  .from("entrevistas")
  .insert({ id: `anon-${Date.now()}`, perfil: {}, alterada_em: new Date().toISOString() });
checar("sem sessão não grava entrevista", !!escritaAnonima.error);

const rpcAnonimo = await anonimo.rpc("receber_entrevista", {
  dados: entrevista(`anon-rpc-${Date.now()}`, "2026-09-18T12:00:00.000Z"),
});
checar("sem sessão a função do banco recusa", !!rpcAnonimo.error, rpcAnonimo.error?.message ?? "");

const uploadAnonimo = await anonimo.storage
  .from("audios")
  .upload(`anon-${Date.now()}/x/y.ogg`, new Blob(["x"]));
checar("sem sessão não sobe áudio", !!uploadAnonimo.error);

// Com duas contas -------------------------------------------------------------

if (A.email && A.senha && B.email && B.senha) {
  const entrar = async ({ email, senha }) => {
    const cliente = createClient(URL, ANON);
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(`login de ${email} falhou: ${error.message}`);
    return cliente;
  };

  const clienteA = await entrar(A);
  const clienteB = await entrar(B);

  const idA = `rls-a-${Date.now()}`;
  const gravou = await clienteA.rpc("receber_entrevista", {
    dados: entrevista(idA, "2026-09-18T12:00:00.000Z"),
  });
  checar("entrevistador grava a própria entrevista", !gravou.error, gravou.error?.message ?? "");

  const leuDeA = await clienteB.from("entrevistas").select("id").eq("id", idA);
  checar("entrevistador B não lê a entrevista de A", (leuDeA.data ?? []).length === 0);

  await clienteB.rpc("receber_entrevista", { dados: entrevista(idA, "2027-01-01T00:00:00.000Z") });
  const depois = await clienteA.from("entrevistas").select("respostas").eq("id", idA).single();
  checar("entrevistador B não sobrescreve a entrevista de A", !!depois.data);

  await clienteA.rpc("receber_entrevista", {
    dados: { ...entrevista(idA, "2026-09-18T11:00:00.000Z"), respostas: { nome: "MAIS VELHA" } },
  });
  const atual = await clienteA.from("entrevistas").select("respostas").eq("id", idA).single();
  checar("versão mais velha não sobrescreve a mais nova", atual.data?.respostas?.nome === "Teste");

  const direto = await clienteA
    .from("entrevistas")
    .insert({ id: `direto-${Date.now()}`, perfil: {}, alterada_em: new Date().toISOString() });
  checar("insert direto na tabela é negado", !!direto.error);

  const foraDaPasta = await clienteB.storage.from("audios").upload(`${idA}/x/y.ogg`, new Blob(["x"]));
  checar("upload fora da própria pasta é negado", !!foraDaPasta.error);
} else {
  console.log(
    "\n(isolamento entre entrevistadores não verificado: rode de novo com CONTA_A/SENHA_A e\n" +
      " CONTA_B/SENHA_B para provar que um entrevistador não lê nem sobrescreve o dado do outro)",
  );
}

const falhas = resultados.filter((ok) => !ok).length;
console.log(
  `\n${resultados.length} verificações · ${resultados.length - falhas} passaram · ${falhas} falharam`,
);
process.exit(falhas ? 1 : 0);
