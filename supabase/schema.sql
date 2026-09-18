-- Schema do servidor do CAIXA Fórmula de Impacto.
-- Spec: specs/2026-09-18-sincronizacao-supabase.md
--
-- Rode inteiro, de uma vez, no SQL Editor do projeto. É idempotente do ponto de vista de
-- "rodou ou não rodou": se parar no meio, corrija e rode tudo de novo num projeto limpo.

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

-- Exige o bucket privado `audios` já criado no painel.
-- Caminho é {entrevistador_id}/{entrevista_id}/{pergunta_id}.{ext}: a primeira pasta é o dono.
create policy "sobe áudio só na própria pasta" on storage.objects for insert
  with check (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "lê áudio da própria pasta" on storage.objects for select
  using (
    bucket_id = 'audios'
    and ((storage.foldername(name))[1] = auth.uid()::text or e_coordenador())
  );
