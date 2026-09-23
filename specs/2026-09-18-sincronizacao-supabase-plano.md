# Plano de implementação — Sincronização com o Supabase

> **Para quem for executar:** as tarefas vêm em passos com checkbox (`- [ ]`). Cada tarefa termina
> num entregável testável sozinho, e cada passo é uma ação de 2 a 5 minutos. Siga a ordem: as
> tarefas 1, 2 e 3 não dependem de nada e podem ser feitas antes de existir projeto no Supabase.

**Objetivo:** cada entrevista sobe para o Supabase quando há sinal, sem que o app perca a
capacidade de funcionar inteiro offline.

**Arquitetura:** o IndexedDB continua sendo a fonte da verdade no aparelho. Um módulo novo
(`lib/sincronizar.mjs`) decide o que falta subir comparando `alteradaEm` com `sincronizadaEm` dentro
da própria entrevista, e envia por duas funções do banco que gravam com a identidade da sessão. A
lógica de decisão é pura e recebe suas dependências por parâmetro, para poder ser testada sem rede e
sem IndexedDB — que é como os testes deste repo já funcionam.

**Stack:** Next.js 15 em export estático, `@supabase/supabase-js`, Postgres com RLS, Supabase
Storage, `node --test`.

**Spec:** `specs/2026-09-18-sincronizacao-supabase.md`

## Restrições globais

- **Offline é inegociável.** Nenhum caminho de entrevista, gravação, exportação ou consolidado pode
  passar a exigir rede. Se o sync falhar, o app segue inteiro.
- **Nada bloqueante na UI.** O sync nunca roda no meio de uma pergunta nem segura um clique.
- **Toda escrita no banco passa por função `security definer`.** O cliente nunca faz `insert`/`update`
  direto em `entrevistas` ou `audios`.
- **`DELETE` não existe no caminho do sync.** Apagar é marcar `apagada_em`.
- **Testes puros, sem rede.** Módulos novos separam decisão (pura, testada em `node --test`) de I/O
  (injetada por parâmetro). Os testes existentes do repo não tocam IndexedDB; os novos também não.
- **Idioma do código:** identificadores, mensagens e comentários em português, como o resto do repo.
  Comentário explica o *porquê*, não o *o quê*.
- **Commits:** um por tarefa, prefixo `feat:`/`fix:`/`test:`, mensagem em português descrevendo o
  efeito, sem `Co-Authored-By`.
- **Chave `anon` é pública.** Ela vai embutida no build estático. Nenhuma regra de acesso pode
  depender de ela ser secreta.

---

### Tarefa 1: Carimbo de alteração e identidade do aparelho

Sem `alteradaEm` não há como saber o que mudou depois do último envio. O carimbo fica numa função
pura para poder ser testado; `salvarEntrevista` passa a usá-la.

**Arquivos:**
- Criar: `lib/aparelho.mjs`
- Modificar: `lib/db.mjs` (`salvarEntrevista`)
- Testar: `test/aparelho.test.mjs`

**Interfaces:**
- Produz: `idDoAparelho() -> string`, `carimbar(entrevista, agora) -> entrevista`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `test/aparelho.test.mjs`:

```js
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
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `node --test test/aparelho.test.mjs`
Esperado: FALHA com `Cannot find module '../lib/aparelho.mjs'`.

- [ ] **Passo 3: Escrever a implementação mínima**

Criar `lib/aparelho.mjs`:

```js
// O id do aparelho responde "de qual tablet veio esta entrevista" quando um deles some ou
// começa a mandar dado estranho. Fica no localStorage porque é do aparelho, não da entrevista.
const CHAVE = "aparelho-formula-impacto";

const gerar = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function idDoAparelho() {
  try {
    const guardado = localStorage.getItem(CHAVE);
    if (guardado) return guardado;
    const novo = gerar();
    localStorage.setItem(CHAVE, novo);
    return novo;
  } catch {
    // Armazenamento bloqueado: o aparelho fica sem nome, e a entrevista sobe do mesmo jeito.
    return "";
  }
}

export const carimbar = (entrevista, agora = new Date().toISOString()) => ({
  ...entrevista,
  aparelhoId: entrevista.aparelhoId || idDoAparelho(),
  alteradaEm: agora,
});
```

- [ ] **Passo 4: Rodar e ver passar**

Comando: `node --test test/aparelho.test.mjs`
Esperado: PASSA, 5 testes.

- [ ] **Passo 5: Ligar o carimbo na gravação**

Em `lib/db.mjs`, adicionar o import no topo, junto dos outros:

```js
import { carimbar } from "./aparelho.mjs";
```

E trocar `salvarEntrevista`:

```js
export const salvarEntrevista = (entrevista) =>
  transacao(["entrevistas"], "readwrite", (store) => store.put(carimbar(entrevista)));
```

- [ ] **Passo 6: Rodar a bateria inteira**

Comando: `npm test`
Esperado: PASSA, 37 testes (32 de antes + 5 novos), 0 falhas.

- [ ] **Passo 7: Commit**

```bash
git add lib/aparelho.mjs lib/db.mjs test/aparelho.test.mjs
git commit -m "feat: entrevista guarda quando mudou e de qual aparelho veio"
```

---

### Tarefa 2: Decidir o que está pendente

O coração do sync, e a parte que mais precisa estar certa: ela decide o que sobe. Puro, sem rede,
sem IndexedDB.

**Arquivos:**
- Criar: `lib/sincronizar.mjs`
- Testar: `test/sincronizar.test.mjs`

**Interfaces:**
- Consome: entrevistas na forma gravada pelo IndexedDB, já com `alteradaEm` (Tarefa 1).
- Produz: `estaPendente(entrevista) -> boolean`, `pendentes(entrevistas) -> entrevista[]`,
  `marcarEnviada(entrevista, quando) -> entrevista`, `paraEnvio(entrevista) -> object`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `test/sincronizar.test.mjs`:

```js
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
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: FALHA com `Cannot find module '../lib/sincronizar.mjs'`.

- [ ] **Passo 3: Escrever a implementação mínima**

Criar `lib/sincronizar.mjs`:

```js
// A pendência mora na própria entrevista, não numa fila à parte. A fila de transcrição vive no
// localStorage e some quando o armazenamento enche — o próprio módulo admite isso. Aqui a
// verdade está no IndexedDB junto do dado, então limpar o localStorage não faz o app esquecer
// o que falta subir.

// Entrevista gravada antes desta versão não tem carimbo nenhum: ausente vale como "nunca subiu".
export const estaPendente = (entrevista) => (entrevista.alteradaEm ?? entrevista.iniciadaEm ?? "") > (entrevista.sincronizadaEm ?? "");

export const pendentes = (entrevistas) =>
  (entrevistas ?? [])
    .filter(estaPendente)
    .sort((a, b) => (a.alteradaEm ?? a.iniciadaEm ?? "").localeCompare(b.alteradaEm ?? b.iniciadaEm ?? ""));

export const marcarEnviada = (entrevista, quando = new Date().toISOString()) => ({
  ...entrevista,
  sincronizadaEm: quando,
});

// `sincronizadaEm` é controle do aparelho e não significa nada no servidor; mandá-lo só
// convidaria alguém a confiar nele do outro lado.
export function paraEnvio(entrevista) {
  const { sincronizadaEm, ...resto } = entrevista;
  return resto;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: PASSA, 8 testes.

- [ ] **Passo 5: Rodar a bateria inteira**

Comando: `npm test`
Esperado: PASSA, 45 testes, 0 falhas.

- [ ] **Passo 6: Commit**

```bash
git add lib/sincronizar.mjs test/sincronizar.test.mjs
git commit -m "feat: decidir quais entrevistas ainda não subiram"
```

---

### Tarefa 3: Schema, RLS e a prova de que um entrevistador não lê o do outro

O dado é nome, comunidade e renda de quilombolas e assentados. Esta tarefa só está pronta quando a
verificação de isolamento passar — ela é o critério de aceite mais importante do spec.

**Arquivos:**
- Criar: `supabase/schema.sql`
- Criar: `scripts/validar-rls.mjs`
- Modificar: `package.json` (script `validar:rls`)

**Interfaces:**
- Produz: as funções `receber_entrevista(jsonb)` e `registrar_audio(jsonb)`, chamadas via
  `supabase.rpc(...)` nas Tarefas 6 e 7.

- [ ] **Passo 1: Criar o projeto no Supabase**

No painel do Supabase, criar um projeto novo dedicado a este app. Anotar a URL do projeto e a chave
`anon`. Criar um bucket **privado** chamado `audios`.

- [ ] **Passo 2: Escrever o schema**

Criar `supabase/schema.sql`:

```sql
-- Tabelas -------------------------------------------------------------------

create table entrevistadores (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  papel text not null default 'entrevistador'
    check (papel in ('entrevistador', 'coordenador')),
  criado_em timestamptz not null default now()
);

-- `id` é text, não uuid: o novoId() do app cai num formato "timestamp-aleatório" quando
-- crypto.randomUUID não existe, e recusar entrevista de campo por causa do formato da
-- chave é o pior jeito de perder trabalho.
create table entrevistas (
  id text primary key,
  entrevistador_id uuid not null references entrevistadores (id),
  aparelho_id text,
  perfil jsonb not null,
  respostas jsonb not null default '{}'::jsonb,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  alterada_em timestamptz not null,
  recebida_em timestamptz not null default now(),
  apagada_em timestamptz
);
create index entrevistas_por_entrevistador on entrevistas (entrevistador_id);

create table audios (
  id text primary key,
  entrevista_id text not null references entrevistas (id),
  pergunta_id text not null,
  mime text,
  bytes int,
  caminho text not null,
  enviado_em timestamptz not null default now()
);
create index audios_por_entrevista on audios (entrevista_id);

-- Papel ---------------------------------------------------------------------

-- Consultar `entrevistadores` dentro de uma política de `entrevistadores` entra em recursão
-- infinita. `security definer` sai do RLS para responder a pergunta.
create function e_coordenador() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from entrevistadores where id = auth.uid() and papel = 'coordenador'
  );
$$;

-- Leitura -------------------------------------------------------------------

alter table entrevistadores enable row level security;
alter table entrevistas enable row level security;
alter table audios enable row level security;

create policy "lê o próprio cadastro" on entrevistadores for select
  using (id = auth.uid() or e_coordenador());

create policy "lê as próprias entrevistas" on entrevistas for select
  using (entrevistador_id = auth.uid() or e_coordenador());

create policy "lê os próprios áudios" on audios for select
  using (
    exists (
      select 1 from entrevistas e
      where e.id = audios.entrevista_id
        and (e.entrevistador_id = auth.uid() or e_coordenador())
    )
  );

-- Nenhuma política de insert, update ou delete. Toda escrita passa pelas funções abaixo.

-- Escrita -------------------------------------------------------------------

create function receber_entrevista(dados jsonb) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sem sessão';
  end if;
  if not exists (select 1 from entrevistadores where id = quem) then
    raise exception 'conta sem entrevistador cadastrado';
  end if;

  insert into entrevistas (
    id, entrevistador_id, aparelho_id, perfil, respostas,
    iniciada_em, concluida_em, alterada_em, apagada_em
  )
  values (
    dados ->> 'id',
    quem,
    dados ->> 'aparelhoId',
    dados -> 'perfil',
    coalesce(dados -> 'respostas', '{}'::jsonb),
    (dados ->> 'iniciadaEm')::timestamptz,
    (dados ->> 'concluidaEm')::timestamptz,
    (dados ->> 'alteradaEm')::timestamptz,
    (dados ->> 'apagadaEm')::timestamptz
  )
  on conflict (id) do update set
    perfil = excluded.perfil,
    respostas = excluded.respostas,
    concluida_em = excluded.concluida_em,
    alterada_em = excluded.alterada_em,
    apagada_em = excluded.apagada_em,
    recebida_em = now()
  -- Dono errado não sobrescreve, e relógio atrasado não apaga versão mais nova.
  where entrevistas.entrevistador_id = quem
    and excluded.alterada_em > entrevistas.alterada_em;
end;
$$;

create function registrar_audio(dados jsonb) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sem sessão';
  end if;
  if not exists (
    select 1 from entrevistas
    where id = dados ->> 'entrevistaId' and entrevistador_id = quem
  ) then
    raise exception 'entrevista não é desta conta';
  end if;

  insert into audios (id, entrevista_id, pergunta_id, mime, bytes, caminho)
  values (
    dados ->> 'id',
    dados ->> 'entrevistaId',
    dados ->> 'perguntaId',
    dados ->> 'mime',
    (dados ->> 'bytes')::int,
    dados ->> 'caminho'
  )
  on conflict (id) do update set
    caminho = excluded.caminho,
    bytes = excluded.bytes,
    mime = excluded.mime,
    enviado_em = now();
end;
$$;

-- Storage -------------------------------------------------------------------

-- Caminho é {entrevistador_id}/{entrevista_id}/{pergunta_id}.{ext}: a primeira pasta é o dono.
create policy "sobe áudio só na própria pasta" on storage.objects for insert
  with check (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "lê áudio da própria pasta" on storage.objects for select
  using (
    bucket_id = 'audios'
    and ((storage.foldername(name))[1] = auth.uid()::text or e_coordenador())
  );
```

- [ ] **Passo 3: Aplicar o schema**

Colar o conteúdo de `supabase/schema.sql` no SQL Editor do painel do Supabase e executar.
Esperado: `Success. No rows returned`.

- [ ] **Passo 4: Criar duas contas de teste**

No painel, em Authentication, criar dois usuários com senha (`a@teste.local` e `b@teste.local`) e
anotar os ids. No SQL Editor, cadastrá-los:

```sql
insert into entrevistadores (id, nome) values
  ('<id-de-a>', 'Entrevistador A'),
  ('<id-de-b>', 'Entrevistador B');
```

- [ ] **Passo 5: Escrever a verificação de isolamento**

Criar `scripts/validar-rls.mjs`:

```js
// A pergunta que este script responde: com a chave que vai embutida no build, alguém alcança
// dado que não é dele? Roda contra o Supabase de verdade, com duas contas de teste.
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
  if (error) throw new Error(`login falhou: ${error.message}`);
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
const direto = await clienteA.from("entrevistas").insert({ id: `direto-${Date.now()}`, perfil: {}, alterada_em: new Date().toISOString() });
checar("insert direto na tabela é negado", !!direto.error);

// Storage fora da própria pasta é negado.
const foraDaPasta = await clienteB.storage.from("audios").upload(`${idA}/x/y.ogg`, new Blob(["x"]));
checar("upload fora da própria pasta é negado", !!foraDaPasta.error);

const falhas = resultados.filter((ok) => !ok).length;
console.log(`\n${resultados.length} verificações · ${resultados.length - falhas} passaram · ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
```

- [ ] **Passo 6: Instalar o cliente e registrar o script**

```bash
npm install @supabase/supabase-js
```

Em `package.json`, adicionar na seção `scripts`, logo depois de `"validar"`:

```json
    "validar:rls": "node scripts/validar-rls.mjs",
```

- [ ] **Passo 7: Rodar a verificação**

```bash
SUPABASE_URL=<url> SUPABASE_ANON_KEY=<anon> \
CONTA_A=a@teste.local SENHA_A=<senha> \
CONTA_B=b@teste.local SENHA_B=<senha> \
npm run validar:rls
```

Esperado: `7 verificações · 7 passaram · 0 falharam`. Qualquer falha aqui interrompe o plano — não
seguir para a Tarefa 4 antes de todas passarem.

- [ ] **Passo 8: Commit**

```bash
git add supabase/schema.sql scripts/validar-rls.mjs package.json package-lock.json
git commit -m "feat: schema e regras de acesso do banco, com prova de isolamento entre contas"
```

---

### Tarefa 4: Cliente do Supabase e as variáveis de ambiente

Export estático embute `NEXT_PUBLIC_*` no build. Esta tarefa também fecha a porta de commitar chave
por acidente, antes de existir qualquer chave no disco.

**Arquivos:**
- Criar: `lib/supabase.mjs`
- Criar: `.env.example`
- Modificar: `.gitignore`
- Modificar: `README.md`

**Interfaces:**
- Produz: `cliente()` (devolve o cliente ou `null` quando não configurado), `configurado() -> boolean`

- [ ] **Passo 1: Fechar a porta antes de abrir a chave**

Em `.gitignore`, acrescentar ao final:

```
.env
.env.local
.env*.local
```

- [ ] **Passo 2: Escrever o exemplo**

Criar `.env.example`:

```
# Copie para .env.local. A chave anon é pública por natureza: ela vai embutida no
# JavaScript do build estático. O que protege o dado é o RLS, não o sigilo dela.
NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon>
```

- [ ] **Passo 3: Escrever o cliente**

Criar `lib/supabase.mjs`:

```js
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Build sem as variáveis continua gerando um app inteiro, só sem envio. É assim que o app
// segue publicável por quem não tem as chaves, e que o campo nunca depende do servidor.
export const configurado = () => Boolean(URL && ANON);

let guardado;

export function cliente() {
  if (!configurado()) return null;
  if (!guardado) {
    guardado = createClient(URL, ANON, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return guardado;
}
```

- [ ] **Passo 4: Verificar que o build passa sem as variáveis**

Comando: `npm run build`
Esperado: build conclui, `out/index.html` existe.

- [ ] **Passo 5: Verificar que o build passa com as variáveis**

Criar `.env.local` a partir do `.env.example`, preenchido com o projeto real, e rodar de novo:

Comando: `npm run build`
Esperado: build conclui. Confirmar que a URL do projeto aparece no bundle:
`grep -rl "supabase.co" out/_next/static/chunks | head -1` devolve um arquivo.

- [ ] **Passo 6: Documentar no README**

Em `README.md`, na seção `## Desenvolvimento`, acrescentar antes do bloco de comandos:

```markdown
O envio para o servidor exige `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em
`.env.local` (veja `.env.example`) e, na publicação, nas variáveis de build do Cloudflare Pages.
Sem elas o app compila e funciona igual, só não envia.
```

- [ ] **Passo 7: Commit**

```bash
git add lib/supabase.mjs .env.example .gitignore README.md
git commit -m "feat: cliente do Supabase, opcional no build"
```

---

### Tarefa 5: Conta do entrevistador na tranca

A tranca ganha um terceiro estado. A lógica de conta sai para um módulo próprio: `Tranca.jsx` já
passa de 200 linhas e é a tela mais sensível do app.

**Arquivos:**
- Criar: `lib/conta.mjs`
- Modificar: `components/Tranca.jsx`
- Modificar: `scripts/cdp.mjs` (`passarPelaTranca`)
- Testar: `test/conta.test.mjs`

**Interfaces:**
- Consome: `cliente()` de `lib/supabase.mjs` (Tarefa 4)
- Produz: `entrarNoServidor(supabase, email, senha) -> { id, nome }`,
  `proximoEstado({ acesso, configurado }) -> "servidor" | "cadastro" | "entrar"`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `test/conta.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { entrarNoServidor, proximoEstado } from "../lib/conta.mjs";

test("aparelho novo com servidor configurado pede a conta primeiro", () => {
  assert.equal(proximoEstado({ acesso: null, configurado: true }), "servidor");
});

test("sem servidor configurado o aparelho novo vai direto ao cadastro do código", () => {
  assert.equal(proximoEstado({ acesso: null, configurado: false }), "cadastro");
});

test("acesso já criado pede só o código", () => {
  assert.equal(proximoEstado({ acesso: { nome: "Maria" }, configurado: true }), "entrar");
});

test("conta confirmada no servidor devolve id e nome do cadastro", async () => {
  const supabase = {
    auth: {
      signInWithPassword: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { nome: "Maria da Silva" }, error: null }) }) }),
    }),
  };
  assert.deepEqual(await entrarNoServidor(supabase, "m@x.com", "senha"), {
    id: "u1",
    nome: "Maria da Silva",
  });
});

test("senha errada vira mensagem de senha errada, não erro cru", async () => {
  const supabase = {
    auth: { signInWithPassword: async () => ({ data: null, error: { message: "Invalid login credentials" } }) },
  };
  await assert.rejects(() => entrarNoServidor(supabase, "m@x.com", "errada"), /E-mail ou senha/);
});

test("conta sem cadastro de entrevistador é recusada com instrução", async () => {
  const supabase = {
    auth: { signInWithPassword: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: "no rows" } }) }) }),
    }),
  };
  await assert.rejects(() => entrarNoServidor(supabase, "m@x.com", "senha"), /coordenador/);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `node --test test/conta.test.mjs`
Esperado: FALHA com `Cannot find module '../lib/conta.mjs'`.

- [ ] **Passo 3: Escrever a implementação mínima**

Criar `lib/conta.mjs`:

```js
// Onde a tranca começa depende de duas coisas: se já existe acesso neste aparelho e se este
// build sabe falar com um servidor. Build sem Supabase não pode exigir conta de ninguém.
export const proximoEstado = ({ acesso, configurado }) => {
  if (acesso) return "entrar";
  return configurado ? "servidor" : "cadastro";
};

export async function entrarNoServidor(supabase, email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error("E-mail ou senha não conferem.");

  const id = data.user.id;
  const cadastro = await supabase.from("entrevistadores").select("nome").eq("id", id).single();
  // Conta do Auth sem linha em `entrevistadores` não grava nada no banco. Recusar aqui evita
  // a pessoa entrevistar o dia inteiro para descobrir no fim que nada subiu.
  if (cadastro.error || !cadastro.data) {
    throw new Error("Esta conta ainda não foi liberada. Fale com o coordenador.");
  }
  return { id, nome: cadastro.data.nome };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Comando: `node --test test/conta.test.mjs`
Esperado: PASSA, 6 testes.

- [ ] **Passo 5: Ligar na tranca**

Em `components/Tranca.jsx`, acrescentar aos imports do topo:

```js
import { entrarNoServidor, proximoEstado } from "@/lib/conta.mjs";
import { cliente, configurado } from "@/lib/supabase.mjs";
```

Acrescentar os estados novos, junto dos que já existem:

```js
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nomeDoServidor, setNomeDoServidor] = useState("");
  const [entrando, setEntrando] = useState(false);
```

Acrescentar o manipulador, depois de `entrar`:

```js
  async function conectarConta(evento) {
    evento.preventDefault();
    setEntrando(true);
    try {
      const { nome: nomeDaConta } = await entrarNoServidor(cliente(), email.trim(), senha);
      setNomeDoServidor(nomeDaConta);
      setNome(nomeDaConta);
      setErro("");
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEntrando(false);
    }
  }
```

Trocar a linha que decide a tela:

```js
  const cadastro = acesso === null;
```

por:

```js
  const etapa = nomeDoServidor ? "cadastro" : proximoEstado({ acesso, configurado: configurado() });
  const cadastro = etapa === "cadastro";
```

No `<form>`, trocar o `onSubmit`:

```js
          <form className="cartao" onSubmit={etapa === "servidor" ? conectarConta : cadastro ? cadastrar : entrar}>
```

Trocar o enunciado:

```js
            <p className="enunciado">
              {etapa === "servidor" ? "Entre com sua conta" : cadastro ? "Primeiro acesso" : `Olá, ${acesso.nome}`}
            </p>
```

Acrescentar os campos de conta, logo depois do enunciado:

```js
            {etapa === "servidor" && (
              <>
                <label className="rotulo" htmlFor="email">
                  Seu e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="o e-mail que o coordenador cadastrou"
                />
                <label className="rotulo" htmlFor="senha">
                  Sua senha
                </label>
                <input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                />
              </>
            )}
```

Esconder o campo de nome quando ele vem do servidor: trocar `{cadastro && (` do bloco do nome por:

```js
            {cadastro && !nomeDoServidor && (
```

E o rótulo do botão:

```js
              {etapa === "servidor" ? (entrando ? "Entrando…" : "Entrar com a conta") : cadastro ? "Criar acesso" : "Entrar"}
```

- [ ] **Passo 6: Ensinar a tela de conta às baterias de navegador**

`passarPelaTranca` em `scripts/cdp.mjs` só conhece `#nome` e `#pin`. Com o Supabase configurado a
primeira tela passa a ser a da conta, e tanto `npm run validar` quanto `npm run test:ui` param na
porta. Trocar o corpo da função por:

```js
  const passarPelaTranca = async (pin = "1234") => {
    if (!(await js(`return Boolean(document.querySelector("#pin") || document.querySelector("#email"));`))) {
      return "destrancado";
    }

    // Build com Supabase pede a conta antes do código. As credenciais de teste vêm do
    // ambiente para não morarem no repositório.
    if (await js(`return Boolean(document.querySelector("#email"));`)) {
      await digitarEm("#email", process.env.CONTA_A ?? "");
      await digitarEm("#senha", process.env.SENHA_A ?? "");
      await clicar("Entrar com a conta");
      await espera(2500);
    }

    const cadastro = await js(`return Boolean(document.querySelector("#confirmacao"));`);
    if (cadastro) {
      if (await js(`return Boolean(document.querySelector("#nome"));`)) {
        await digitarEm("#nome", "Entrevistador de Teste");
      }
      await digitarEm("#pin", pin);
      await digitarEm("#confirmacao", pin);
      await clicar("Criar acesso");
    } else {
      await digitarEm("#pin", pin);
      await clicar("Entrar");
    }
    await espera(1400);
    return cadastro ? "acesso criado" : "entrou";
  };
```

Note que a decisão entre cadastro e entrada passa a olhar `#confirmacao`, não `#nome`: com a conta
vinda do servidor o campo de nome não aparece, e olhar para ele faria a bateria tentar "Entrar" numa
tela de primeiro acesso.

- [ ] **Passo 7: Rodar a bateria inteira**

Comando: `npm test`
Esperado: PASSA, 51 testes, 0 falhas.

- [ ] **Passo 8: Conferir que as baterias de navegador continuam passando**

Com `.env.local` preenchido:

```bash
npm run build && npm run servir
CDP_PORT=9223 BASE_URL=http://localhost:3000 CONTA_A=a@teste.local SENHA_A=<senha> npm run validar
```

Esperado: `40 verificações · 40 passaram · 0 falharam` — as mesmas de antes, agora atravessando a
tela de conta.

- [ ] **Passo 9: Conferir na tela, com e sem servidor**

```bash
npm run build && npm run servir
```

Com `.env.local` preenchido, abrir `http://localhost:3000` numa janela anônima: a primeira tela pede
e-mail e senha. Entrar com a conta de teste: a tela passa a pedir só o código de 4 números, já com o
nome vindo do servidor. Renomear `.env.local` para `.env.local.off`, rebuildar e repetir: a primeira
tela volta a ser a de nome e código, como hoje.

- [ ] **Passo 10: Commit**

```bash
git add lib/conta.mjs components/Tranca.jsx scripts/cdp.mjs test/conta.test.mjs
git commit -m "feat: entrevistador entra com a conta antes de criar o código do aparelho"
```

---

### Tarefa 6: Enviar as entrevistas

**Arquivos:**
- Modificar: `lib/sincronizar.mjs`
- Testar: `test/sincronizar.test.mjs`

**Interfaces:**
- Consome: `pendentes`, `paraEnvio`, `marcarEnviada` (Tarefa 2); `receber_entrevista` (Tarefa 3)
- Produz: `enviarEntrevistas({ supabase, listar, salvar, agora }) -> { enviadas, falhas }`

- [ ] **Passo 1: Escrever o teste que falha**

Acrescentar ao final de `test/sincronizar.test.mjs`:

```js
import { enviarEntrevistas } from "../lib/sincronizar.mjs";

const bancoFalso = (lista) => {
  const dados = new Map(lista.map((e) => [e.id, e]));
  return {
    listar: async () => [...dados.values()],
    salvar: async (e) => dados.set(e.id, e),
    ver: (id) => dados.get(id),
  };
};

const supabaseFalso = (respostaDoRpc = { error: null }) => {
  const chamadas = [];
  return {
    chamadas,
    rpc: async (nome, args) => {
      chamadas.push({ nome, args });
      return typeof respostaDoRpc === "function" ? respostaDoRpc(args) : respostaDoRpc;
    },
  };
};

test("envia só as pendentes e marca cada uma como enviada", async () => {
  const banco = bancoFalso([
    entrevista({ id: "pendente", alteradaEm: "2026-09-18T12:00:00.000Z" }),
    entrevista({ id: "ja-foi", alteradaEm: "2026-09-18T10:00:00.000Z", sincronizadaEm: "2026-09-18T11:00:00.000Z" }),
  ]);
  const supabase = supabaseFalso();

  const saida = await enviarEntrevistas({
    supabase,
    listar: banco.listar,
    salvar: banco.salvar,
    agora: () => "2026-09-18T13:00:00.000Z",
  });

  assert.deepEqual(saida, { enviadas: 1, falhas: 0 });
  assert.equal(supabase.chamadas.length, 1);
  assert.equal(supabase.chamadas[0].nome, "receber_entrevista");
  assert.equal(supabase.chamadas[0].args.dados.id, "pendente");
  assert.equal(banco.ver("pendente").sincronizadaEm, "2026-09-18T13:00:00.000Z");
});

test("falha no servidor mantém a pendência, sem marcar envio", async () => {
  const banco = bancoFalso([entrevista({ id: "e1", alteradaEm: "2026-09-18T12:00:00.000Z" })]);
  const saida = await enviarEntrevistas({
    supabase: supabaseFalso({ error: { message: "502" } }),
    listar: banco.listar,
    salvar: banco.salvar,
    agora: () => "2026-09-18T13:00:00.000Z",
  });

  assert.deepEqual(saida, { enviadas: 0, falhas: 1 });
  assert.equal(banco.ver("e1").sincronizadaEm, undefined);
});

test("uma entrevista com problema não impede as outras de subir", async () => {
  const banco = bancoFalso([
    entrevista({ id: "ruim", alteradaEm: "2026-09-18T11:00:00.000Z" }),
    entrevista({ id: "boa", alteradaEm: "2026-09-18T12:00:00.000Z" }),
  ]);
  const supabase = supabaseFalso(({ dados }) =>
    dados.id === "ruim" ? { error: { message: "boom" } } : { error: null },
  );

  const saida = await enviarEntrevistas({
    supabase,
    listar: banco.listar,
    salvar: banco.salvar,
    agora: () => "2026-09-18T13:00:00.000Z",
  });

  assert.deepEqual(saida, { enviadas: 1, falhas: 1 });
  assert.equal(banco.ver("boa").sincronizadaEm, "2026-09-18T13:00:00.000Z");
  assert.equal(banco.ver("ruim").sincronizadaEm, undefined);
});

test("sem servidor configurado não tenta nada e não quebra", async () => {
  const banco = bancoFalso([entrevista({ id: "e1", alteradaEm: "2026-09-18T12:00:00.000Z" })]);
  const saida = await enviarEntrevistas({ supabase: null, listar: banco.listar, salvar: banco.salvar });
  assert.deepEqual(saida, { enviadas: 0, falhas: 0 });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: FALHA com `enviarEntrevistas is not a function` (ou erro de import).

- [ ] **Passo 3: Escrever a implementação mínima**

Acrescentar ao final de `lib/sincronizar.mjs`:

```js
// As dependências entram por parâmetro para o teste rodar sem rede e sem IndexedDB — o mesmo
// motivo pelo qual o resto deste repo só testa função pura.
export async function enviarEntrevistas({ supabase, listar, salvar, agora = () => new Date().toISOString() }) {
  if (!supabase) return { enviadas: 0, falhas: 0 };

  const fila = pendentes(await listar());
  let enviadas = 0;
  let falhas = 0;

  for (const entrevista of fila) {
    const { error } = await supabase.rpc("receber_entrevista", { dados: paraEnvio(entrevista) });
    if (error) {
      // Uma entrevista com problema não pode segurar o resto da leva: a próxima tentativa
      // pega ela de novo, porque a pendência continua marcada nela mesma.
      falhas += 1;
      continue;
    }
    await salvar(marcarEnviada(entrevista, agora()));
    enviadas += 1;
  }

  return { enviadas, falhas };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: PASSA, 12 testes.

- [ ] **Passo 5: Rodar a bateria inteira**

Comando: `npm test`
Esperado: PASSA, 55 testes, 0 falhas.

- [ ] **Passo 6: Commit**

```bash
git add lib/sincronizar.mjs test/sincronizar.test.mjs
git commit -m "feat: subir as entrevistas pendentes, uma falha não segurando as outras"
```

---

### Tarefa 7: Enviar os áudios, só no Wi-Fi

**Arquivos:**
- Modificar: `lib/sincronizar.mjs`
- Testar: `test/sincronizar.test.mjs`

**Interfaces:**
- Consome: `registrar_audio` (Tarefa 3); `audiosDaEntrevista` de `lib/db.mjs`
- Produz: `noWifi(conexao) -> boolean`,
  `enviarAudios({ supabase, entrevistadorId, listar, audiosDe, salvarAudio, conexao, forcar, agora }) -> { enviados, falhas, esperando }`

- [ ] **Passo 1: Escrever o teste que falha**

Acrescentar ao final de `test/sincronizar.test.mjs`:

```js
import { enviarAudios, noWifi } from "../lib/sincronizar.mjs";

test("Wi-Fi é reconhecido quando o navegador conta qual é a conexão", () => {
  assert.equal(noWifi({ type: "wifi" }), true);
  assert.equal(noWifi({ type: "cellular" }), false);
});

// O Safari não expõe navigator.connection, e o Safari é justamente o iPad. Assumir Wi-Fi ali
// gastaria dado móvel de alguém sem avisar.
test("navegador que não conta a conexão é tratado como fora do Wi-Fi", () => {
  assert.equal(noWifi(undefined), false);
});

const armazenamentoFalso = () => {
  const enviados = [];
  return {
    enviados,
    from: () => ({
      upload: async (caminho) => {
        enviados.push(caminho);
        return { error: null };
      },
    }),
  };
};

const audio = (extra) => ({
  id: "a1",
  entrevistaId: "e1",
  perguntaId: "p1",
  blob: { size: 10, type: "audio/ogg" },
  extensao: "ogg",
  ...extra,
});

const enviada = entrevista({ id: "e1", alteradaEm: "2026-09-18T12:00:00.000Z", sincronizadaEm: "2026-09-18T13:00:00.000Z" });

test("fora do Wi-Fi os áudios ficam esperando, sem subir nada", async () => {
  const supabase = { ...supabaseFalso(), storage: armazenamentoFalso() };
  const saida = await enviarAudios({
    supabase,
    entrevistadorId: "u1",
    listar: async () => [enviada],
    audiosDe: async () => [audio()],
    salvarAudio: async () => {},
    conexao: { type: "cellular" },
  });
  assert.deepEqual(saida, { enviados: 0, falhas: 0, esperando: 1 });
  assert.equal(supabase.storage.enviados.length, 0);
});

test("com o envio forçado o áudio sobe mesmo fora do Wi-Fi", async () => {
  const armazenamento = armazenamentoFalso();
  const supabase = { ...supabaseFalso(), storage: armazenamento };
  const saida = await enviarAudios({
    supabase,
    entrevistadorId: "u1",
    listar: async () => [enviada],
    audiosDe: async () => [audio()],
    salvarAudio: async () => {},
    conexao: { type: "cellular" },
    forcar: true,
  });
  assert.deepEqual(saida, { enviados: 1, falhas: 0, esperando: 0 });
  assert.deepEqual(armazenamento.enviados, ["u1/e1/p1.ogg"]);
});

// Áudio é o que pesa. Sem anotar o envio no aparelho, cada sync subiria os mesmos megabytes
// de novo — e o entrevistador pagaria por isso no plano de dados dele.
test("áudio enviado fica anotado no aparelho e não sobe de novo", async () => {
  const armazenamento = armazenamentoFalso();
  const supabase = { ...supabaseFalso(), storage: armazenamento };
  const gravados = [];
  const comum = {
    supabase,
    entrevistadorId: "u1",
    listar: async () => [enviada],
    salvarAudio: async (a) => gravados.push(a),
    conexao: { type: "wifi" },
    agora: () => "2026-09-18T14:00:00.000Z",
  };

  await enviarAudios({ ...comum, audiosDe: async () => [audio()] });
  assert.equal(gravados[0].enviadoEm, "2026-09-18T14:00:00.000Z");

  const segunda = await enviarAudios({ ...comum, audiosDe: async () => [gravados[0]] });
  assert.deepEqual(segunda, { enviados: 0, falhas: 0, esperando: 0 });
  assert.equal(armazenamento.enviados.length, 1);
});

test("falha no upload não anota envio nenhum no aparelho", async () => {
  const gravados = [];
  const supabase = {
    ...supabaseFalso(),
    storage: { from: () => ({ upload: async () => ({ error: { message: "413" } }) }) },
  };
  const saida = await enviarAudios({
    supabase,
    entrevistadorId: "u1",
    listar: async () => [enviada],
    audiosDe: async () => [audio()],
    salvarAudio: async (a) => gravados.push(a),
    conexao: { type: "wifi" },
  });
  assert.deepEqual(saida, { enviados: 0, falhas: 1, esperando: 0 });
  assert.equal(gravados.length, 0);
});

test("áudio de entrevista que ainda não subiu espera a entrevista ir primeiro", async () => {
  const armazenamento = armazenamentoFalso();
  const supabase = { ...supabaseFalso(), storage: armazenamento };
  const saida = await enviarAudios({
    supabase,
    entrevistadorId: "u1",
    listar: async () => [entrevista({ id: "e1", alteradaEm: "2026-09-18T12:00:00.000Z" })],
    audiosDe: async () => [audio()],
    salvarAudio: async () => {},
    conexao: { type: "wifi" },
  });
  assert.deepEqual(saida, { enviados: 0, falhas: 0, esperando: 1 });
  assert.equal(armazenamento.enviados.length, 0);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: FALHA com `enviarAudios is not a function`.

- [ ] **Passo 3: Escrever a implementação mínima**

Acrescentar ao final de `lib/sincronizar.mjs`:

```js
// `navigator.connection` não existe no Safari, que é justamente o iPad usado em campo. Sem
// saber, o app assume que não é Wi-Fi: gastar dado móvel de alguém sem avisar é pior que
// deixar o áudio esperando um toque no botão.
export const noWifi = (conexao) => conexao?.type === "wifi";

export async function enviarAudios({
  supabase,
  entrevistadorId,
  listar,
  audiosDe,
  salvarAudio,
  conexao,
  forcar = false,
  agora = () => new Date().toISOString(),
}) {
  if (!supabase || !entrevistadorId) return { enviados: 0, falhas: 0, esperando: 0 };

  const podeSubir = forcar || noWifi(conexao);
  let enviados = 0;
  let falhas = 0;
  let esperando = 0;

  for (const entrevista of await listar()) {
    // A linha de `audios` aponta para a entrevista: mandar o áudio antes dela deixaria um
    // arquivo sem dono no servidor.
    const audios = await audiosDe(entrevista.id);
    const prontos = estaPendente(entrevista) ? [] : audios;
    esperando += audios.length - prontos.length;

    for (const audio of prontos) {
      if (audio.enviadoEm) continue;
      if (!podeSubir) {
        esperando += 1;
        continue;
      }
      const caminho = `${entrevistadorId}/${entrevista.id}/${audio.perguntaId}.${audio.extensao}`;
      const subiu = await supabase.storage.from("audios").upload(caminho, audio.blob, { upsert: true });
      if (subiu.error) {
        falhas += 1;
        continue;
      }
      const { error } = await supabase.rpc("registrar_audio", {
        dados: {
          id: audio.id,
          entrevistaId: entrevista.id,
          perguntaId: audio.perguntaId,
          mime: audio.blob.type,
          bytes: audio.blob.size,
          caminho,
        },
      });
      if (error) {
        falhas += 1;
        continue;
      }
      // Anotar no aparelho é o que impede o próximo sync de subir os mesmos megabytes.
      await salvarAudio({ ...audio, enviadoEm: agora() });
      enviados += 1;
    }
  }

  return { enviados, falhas, esperando };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: PASSA, 20 testes.

- [ ] **Passo 5: Rodar a bateria inteira**

Comando: `npm test`
Esperado: PASSA, 63 testes, 0 falhas.

- [ ] **Passo 6: Commit**

```bash
git add lib/sincronizar.mjs test/sincronizar.test.mjs
git commit -m "feat: áudio sobe para o servidor, esperando o Wi-Fi por padrão"
```

---

### Tarefa 8: Apagar no aparelho avisa o servidor

`apagarEntrevista` hoje remove a linha do IndexedDB. Se continuar assim, a entrevista some antes de
o sync conseguir contar ao servidor, e o `apagada_em` do spec nunca é preenchido. Apagar passa a
ser: marcar, avisar, e só então remover do aparelho.

**Arquivos:**
- Modificar: `lib/db.mjs` (`apagarEntrevista`)
- Modificar: `lib/sincronizar.mjs` (`enviarEntrevistas`)
- Modificar: `app/page.jsx` (`apagar`)
- Testar: `test/sincronizar.test.mjs`

**Interfaces:**
- Consome: `estaPendente`, `enviarEntrevistas` (Tarefas 2 e 6)
- Produz: `marcarApagada(entrevista, quando) -> entrevista`; `apagarEntrevista` passa a receber
  `{ definitivo }`

- [ ] **Passo 1: Escrever o teste que falha**

Acrescentar ao final de `test/sincronizar.test.mjs`:

```js
import { marcarApagada } from "../lib/sincronizar.mjs";

test("marcar apagada deixa a entrevista pendente de novo, para o servidor saber", () => {
  const antes = entrevista({ alteradaEm: "2026-09-18T12:00:00.000Z", sincronizadaEm: "2026-09-18T13:00:00.000Z" });
  const depois = marcarApagada(antes, "2026-09-18T14:00:00.000Z");
  assert.equal(depois.apagadaEm, "2026-09-18T14:00:00.000Z");
  assert.equal(depois.alteradaEm, "2026-09-18T14:00:00.000Z");
  assert.equal(estaPendente(depois), true);
});

test("entrevista apagada some do aparelho depois de o servidor confirmar", async () => {
  const banco = bancoFalso([
    entrevista({ id: "e1", alteradaEm: "2026-09-18T14:00:00.000Z", apagadaEm: "2026-09-18T14:00:00.000Z" }),
  ]);
  const removidas = [];

  const saida = await enviarEntrevistas({
    supabase: supabaseFalso(),
    listar: banco.listar,
    salvar: banco.salvar,
    remover: async (id) => removidas.push(id),
    agora: () => "2026-09-18T14:00:05.000Z",
  });

  assert.deepEqual(saida, { enviadas: 1, falhas: 0 });
  assert.deepEqual(removidas, ["e1"]);
});

test("apagada que o servidor recusou continua no aparelho para tentar de novo", async () => {
  const banco = bancoFalso([
    entrevista({ id: "e1", alteradaEm: "2026-09-18T14:00:00.000Z", apagadaEm: "2026-09-18T14:00:00.000Z" }),
  ]);
  const removidas = [];

  await enviarEntrevistas({
    supabase: supabaseFalso({ error: { message: "502" } }),
    listar: banco.listar,
    salvar: banco.salvar,
    remover: async (id) => removidas.push(id),
  });

  assert.deepEqual(removidas, []);
  assert.ok(banco.ver("e1"));
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: FALHA com `marcarApagada is not a function`.

- [ ] **Passo 3: Escrever a implementação mínima**

Acrescentar a `lib/sincronizar.mjs`, junto de `marcarEnviada`:

```js
// Apagar avança o relógio de alteração de propósito: é isso que põe a entrevista de volta na
// fila, para o servidor ficar sabendo antes de o aparelho esquecer.
export const marcarApagada = (entrevista, quando = new Date().toISOString()) => ({
  ...entrevista,
  apagadaEm: quando,
  alteradaEm: quando,
});
```

Trocar o corpo do laço de `enviarEntrevistas` para remover depois de confirmado, e acrescentar
`remover` aos parâmetros:

```js
export async function enviarEntrevistas({
  supabase,
  listar,
  salvar,
  remover,
  agora = () => new Date().toISOString(),
}) {
  if (!supabase) return { enviadas: 0, falhas: 0 };

  const fila = pendentes(await listar());
  let enviadas = 0;
  let falhas = 0;

  for (const entrevista of fila) {
    const { error } = await supabase.rpc("receber_entrevista", { dados: paraEnvio(entrevista) });
    if (error) {
      // Uma entrevista com problema não pode segurar o resto da leva: a próxima tentativa
      // pega ela de novo, porque a pendência continua marcada nela mesma.
      falhas += 1;
      continue;
    }
    // Só agora o aparelho pode esquecer: o servidor já tem a marca de apagada.
    if (entrevista.apagadaEm && remover) await remover(entrevista.id);
    else await salvar(marcarEnviada(entrevista, agora()));
    enviadas += 1;
  }

  return { enviadas, falhas };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Comando: `node --test test/sincronizar.test.mjs`
Esperado: PASSA, 23 testes.

- [ ] **Passo 5: Separar apagar de remover no banco local**

Em `lib/db.mjs`, trocar `apagarEntrevista` por duas funções — a marca e a remoção de verdade:

```js
export const removerEntrevista = (id) =>
  transacao(["entrevistas", "audios"], "readwrite", (entrevistas, audios) => {
    entrevistas.delete(id);
    const busca = audios.index("entrevistaId").getAllKeys(id);
    busca.onsuccess = () => busca.result.forEach((chave) => audios.delete(chave));
  });

// Com servidor, apagar é marcar e deixar o sync avisar; sem servidor, é remover na hora.
export const apagarEntrevista = async (id, { avisarServidor }) => {
  if (!avisarServidor) return removerEntrevista(id);
  const entrevista = await obterEntrevista(id);
  if (!entrevista) return;
  await salvarEntrevista(marcarApagada(entrevista));
};
```

E acrescentar o import no topo de `lib/db.mjs`:

```js
import { marcarApagada } from "./sincronizar.mjs";
```

- [ ] **Passo 6: Ligar na tela**

Em `app/page.jsx`, trocar a função `apagar`:

```js
  async function apagar(id) {
    try {
      await apagarEntrevista(id, { avisarServidor: Boolean(cliente()) });
      setEntrevistas((await listarEntrevistas()).filter((e) => !e.apagadaEm));
    } catch {
      setFalha("Não consegui apagar agora. Tente de novo.");
    }
    setParaApagar(null);
  }
```

E, no efeito que carrega a lista, filtrar as marcadas para que não reapareçam na tela — trocar

```js
    listarEntrevistas().then(setEntrevistas);
```

por

```js
    listarEntrevistas().then((lista) => setEntrevistas(lista.filter((e) => !e.apagadaEm)));
```

- [ ] **Passo 7: Passar `remover` ao sync**

Em `app/page.jsx`, no efeito de sincronização, acrescentar `removerEntrevista` ao import de
`lib/db.mjs` e passar ao motor:

```js
      await enviarEntrevistas({
        supabase,
        listar: listarEntrevistas,
        salvar: salvarEntrevista,
        remover: removerEntrevista,
      });
```

- [ ] **Passo 8: Rodar a bateria inteira**

Comando: `npm test`
Esperado: PASSA, 66 testes, 0 falhas.

- [ ] **Passo 9: Conferir na tela**

```bash
npm run build && npm run servir
```

Criar uma entrevista, esperar aparecer como *enviada*, apagá-la e recarregar. Esperado: ela some da
lista do aparelho, e no painel do Supabase a linha continua lá com `apagada_em` preenchido.

- [ ] **Passo 10: Commit**

```bash
git add lib/db.mjs lib/sincronizar.mjs app/page.jsx test/sincronizar.test.mjs
git commit -m "feat: apagar no aparelho avisa o servidor antes de esquecer a entrevista"
```

---

### Tarefa 9: Mostrar o estado do envio na tela inicial

Hoje o entrevistador não tem como saber se pode limpar o tablet. Esta tarefa liga o motor à tela.

**Arquivos:**
- Modificar: `app/page.jsx`

**Interfaces:**
- Consome: `enviarEntrevistas`, `enviarAudios`, `estaPendente` (Tarefas 2, 6, 7); `cliente` (Tarefa 4)

- [ ] **Passo 1: Ligar o sync na abertura e na volta da rede**

Em `app/page.jsx`, acrescentar aos imports:

```js
import {
  apagarEntrevista,
  audiosDaEntrevista,
  listarEntrevistas,
  novoId,
  removerEntrevista,
  salvarAudio,
  salvarEntrevista,
} from "@/lib/db.mjs";
import { enviarAudios, enviarEntrevistas, estaPendente } from "@/lib/sincronizar.mjs";
import { cliente } from "@/lib/supabase.mjs";
import { aoVoltarOnline } from "@/lib/transcrever.mjs";
```

(a linha de `db.mjs` substitui a que já existe, acrescentando `audiosDaEntrevista`,
`removerEntrevista` e `salvarAudio`)

Acrescentar o estado, junto dos outros:

```js
  const [envio, setEnvio] = useState({ entrevistas: 0, audios: 0 });
  const [enviandoAudios, setEnviandoAudios] = useState(false);
```

Acrescentar o efeito, depois do `useEffect` que já existe:

```js
  // Só na abertura e na volta da rede. Nunca no meio de uma pergunta: o app não pode esperar
  // servidor com o entrevistado na frente.
  useEffect(() => {
    const sincronizar = async () => {
      const supabase = cliente();
      if (!supabase || !navigator.onLine) return;
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      await enviarEntrevistas({
        supabase,
        listar: listarEntrevistas,
        salvar: salvarEntrevista,
        remover: removerEntrevista,
      });
      const lista = (await listarEntrevistas()).filter((e) => !e.apagadaEm);
      setEntrevistas(lista);
      const audios = await enviarAudios({
        supabase,
        entrevistadorId: data.user.id,
        listar: listarEntrevistas,
        audiosDe: audiosDaEntrevista,
        salvarAudio,
        conexao: navigator.connection,
      });
      setEnvio({ entrevistas: lista.filter(estaPendente).length, audios: audios.esperando });
    };
    sincronizar().catch(() => {});
    return aoVoltarOnline(() => sincronizar().catch(() => {}));
  }, []);
```

- [ ] **Passo 2: Mostrar o resumo e o botão**

Em `app/page.jsx`, dentro do bloco `{entrevistas.length > 0 && (`, logo depois da linha do `<h2 className="secao">`, acrescentar:

```jsx
            {(envio.entrevistas > 0 || envio.audios > 0) && (
              <p className="discreto">
                {envio.entrevistas > 0 && `${envio.entrevistas} ainda não enviadas`}
                {envio.entrevistas > 0 && envio.audios > 0 && " · "}
                {envio.audios > 0 && `${envio.audios} áudios esperando Wi-Fi`}
              </p>
            )}
```

- [ ] **Passo 3: Marcar cada entrevista da lista**

Em `app/page.jsx`, dentro do `<li>` de cada entrevista, trocar o `<span className="discreto">` que mostra o progresso por:

```jsx
                      <span className="discreto">
                        {feitas}/{total}
                        <br />
                        {estaPendente(entrevista) ? "no aparelho" : "enviada"}
                      </span>
```

- [ ] **Passo 4: Acrescentar o botão de forçar os áudios**

Em `app/page.jsx`, no bloco de botões que já tem "Ver consolidado" e "Exportar tudo (ZIP)",
acrescentar antes do de exportar:

```jsx
              {envio.audios > 0 && (
                <button
                  type="button"
                  className="botao secundario"
                  disabled={enviandoAudios}
                  onClick={async () => {
                    setEnviandoAudios(true);
                    try {
                      const supabase = cliente();
                      const { data } = await supabase.auth.getUser();
                      const saida = await enviarAudios({
                        supabase,
                        entrevistadorId: data.user.id,
                        listar: listarEntrevistas,
                        audiosDe: audiosDaEntrevista,
                        salvarAudio,
                        forcar: true,
                      });
                      setEnvio((atual) => ({ ...atual, audios: saida.esperando }));
                    } catch {
                      setFalha("Não consegui enviar os áudios agora. Tente de novo com sinal melhor.");
                    } finally {
                      setEnviandoAudios(false);
                    }
                  }}
                >
                  {enviandoAudios ? "Enviando…" : `Enviar ${envio.audios} áudios agora`}
                </button>
              )}
```

- [ ] **Passo 5: Conferir na tela**

```bash
npm run build && npm run servir
```

Abrir `http://localhost:3000`, entrar com a conta de teste, criar uma entrevista e responder uma
pergunta. Esperado: a entrevista aparece como *no aparelho* e, segundos depois de recarregar,
como *enviada*. Confirmar no painel do Supabase que a linha chegou em `entrevistas`.

- [ ] **Passo 6: Rodar a bateria inteira**

Comando: `npm test`
Esperado: PASSA, 66 testes, 0 falhas.

- [ ] **Passo 7: Commit**

```bash
git add app/page.jsx
git commit -m "feat: tela inicial mostra o que já subiu e o que ainda está só no aparelho"
```

---

### Tarefa 10: Cenários de sync na bateria funcional

Os testes de unidade provam a decisão; esta tarefa prova o caminho inteiro num Chrome de verdade,
com a rede sendo desligada e religada.

**Arquivos:**
- Modificar: `scripts/validar.mjs`
- Modificar: `README.md`

- [ ] **Passo 1: Acrescentar o cenário**

Em `scripts/validar.mjs`, antes da linha que imprime o resumo final, acrescentar:

```js
await cenario("sync", async () => {
  await limparAparelho();
  await irPara("/");
  await passarPelaTranca();

  // Entrevista inteira feita com a rede desligada: é o caso real de campo.
  await rede(true);
  await clicarOpcao("Agricultor(a) familiar");
  await clicarOpcao("Jovem (até 29)");
  await clicarOpcao("Masculino");
  await clicar("Começar entrevista");
  await espera(1200);
  await preencher("Nome", "Teste de Sync");
  await espera(900);

  await irPara("/");
  checar(
    "sync: entrevista feita sem sinal aparece como só no aparelho",
    (await textoDaTela()).includes("no aparelho"),
  );
  checar(
    "sync: sem sinal o app não trava nem esconde a lista",
    (await textoDaTela()).includes("Quem você vai entrevistar?"),
  );

  await rede(false);
  await irPara("/");
  const subiu = await ate(async () => (await textoDaTela()).includes("enviada"), 30);
  checar("sync: a volta da rede sobe a entrevista sozinha", subiu);

  checar(
    "sync: o app segue utilizável depois do envio",
    (await textoDaTela()).includes("Quem você vai entrevistar?"),
  );
});
```

- [ ] **Passo 2: Rodar a bateria**

```bash
CDP_PORT=9223 BASE_URL=http://localhost:3000 npm run validar
```

Esperado: as 40 verificações anteriores continuam passando, mais as 4 novas — `44 verificações ·
44 passaram · 0 falharam`.

- [ ] **Passo 3: Atualizar o README**

Em `README.md`, na tabela `## Como funciona`, acrescentar a linha:

```markdown
| Envio para o servidor | `lib/sincronizar.mjs`, `supabase/schema.sql` |
```

E no bloco de comandos de `## Desenvolvimento`:

```bash
npm run validar:rls  # prova que um entrevistador não lê o dado do outro
```

- [ ] **Passo 4: Commit**

```bash
git add scripts/validar.mjs README.md
git commit -m "test: bateria funcional cobre o envio depois da volta da rede"
```

---

## Depois deste plano

- **Painel do coordenador** — spec próprio. Até lá, uma view SQL no painel do Supabase sobre
  `entrevistas` já responde o consolidado da equipe.
- **A virada em campo** — publicar, criar as contas, e só então pedir à equipe que abra o app no
  Wi-Fi. Enquanto um tablet não abrir a versão nova com sinal, o dado dele existe só nele.
