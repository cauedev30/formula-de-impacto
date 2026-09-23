# Sincronização das entrevistas com o Supabase

## Intenção

Hoje a entrevista existe num lugar só: o IndexedDB do tablet que a gravou. Não há cópia. Um tablet
perdido, um "limpar dados do site" ou o Safari apagando o armazenamento de um site que ficou sete
dias sem uso levam junto o trabalho de campo de um dia inteiro, e não há de onde recuperar. O
consolidado, pela mesma razão, é sempre parcial: cada aparelho só soma o que ele mesmo coletou, e
juntar a equipe depende de alguém recolher um ZIP por tablet.

Este spec acrescenta um servidor: cada entrevista sobe para o Supabase assim que há sinal, e o
coordenador passa a ver todas as entrevistas de toda a equipe num lugar só.

Acrescenta — não substitui. O app continua funcionando inteiro sem sinal, que é a razão de ele
existir: entrevistar, gravar áudio, exportar ZIP e ver o consolidado local seguem idênticos, com ou
sem servidor. Se o Supabase estiver fora do ar, o campo não sente.

Isto reverte, de propósito, duas linhas do `2026-09-04-formulario-campo.md`, que punha em "fora de
escopo" o banco na nuvem e o login. A premissa de lá — um entrevistador, um tablet, sem rede —
continua valendo para a entrevista; o que mudou é que o dado não pode mais terminar ali.

## Decisões

**A entrevista inteira sobe, e a versão mais nova vence.** Cada entrevista vive num tablet só, e
ninguém edita a mesma entrevista em dois aparelhos. Não há conflito real para resolver, então não há
log de eventos nem merge: o cliente manda o JSON inteiro e o servidor aceita se for mais novo que o
que está lá. Log de eventos resolveria um problema que este produto não tem, ao custo de replay e de
uma tabela a mais.

**A pendência mora na própria entrevista, não numa fila.** `lib/transcrever.mjs` guarda a fila de
áudios pendentes no `localStorage`, e o próprio código admite no comentário que a pendência se perde
se o armazenamento encher. Aqui não existe fila separada: a entrevista carrega `alteradaEm` e
`sincronizadaEm`, e está pendente tudo em que `alteradaEm` é mais novo que `sincronizadaEm`. Limpar
o `localStorage` não faz o app esquecer o que falta subir.

**O `id` da entrevista é `text`, não `uuid`.** O `novoId()` de `lib/db.mjs` cai num formato
`timestamp-aleatório` quando `crypto.randomUUID` não existe — exatamente o caso do app aberto fora
de um contexto seguro. Uma coluna `uuid` recusaria essas entrevistas, e recusar dado de campo por
causa do formato da chave é o pior jeito de perder trabalho.

**Ninguém apaga de verdade.** Apagar no tablet marca `apagada_em` no servidor. O coordenador não vê,
e o dado continua lá. O objetivo deste spec é parar de perder entrevista; um `DELETE` no caminho do
sync contradiz isso.

**A regra de acesso fica no banco, não no app.** As entrevistas trazem nome, comunidade e renda de
quilombolas e assentados. A chave `anon` vai embutida no build estático e deve ser tratada como
pública: quem a tiver não pode ler nada sem uma sessão, e uma sessão só alcança o que as políticas
de RLS permitem.

## Modelo de dados

Projeto Supabase novo, dedicado a este app.

```
entrevistadores   id uuid pk (= auth.users.id) · nome text · papel text
                  ('entrevistador' | 'coordenador') · criado_em timestamptz

entrevistas       id text pk (gerado no tablet) · entrevistador_id uuid · aparelho_id text
                  perfil jsonb · respostas jsonb
                  iniciada_em timestamptz · concluida_em timestamptz
                  alterada_em timestamptz (relógio do tablet)
                  recebida_em timestamptz (relógio do servidor)
                  apagada_em timestamptz

audios            id text pk (gerado no tablet) · entrevista_id text · pergunta_id text
                  mime text · bytes int · caminho text · enviado_em timestamptz

bucket "audios"   privado · {entrevistador_id}/{entrevista_id}/{pergunta_id}.{ext}
```

`respostas` sobe como o JSON que o app já usa, sem normalizar em uma linha por resposta. O
consolidado conta opções dentro desse objeto, e no servidor faz o mesmo com `jsonb`; uma tabela de
respostas seria estrutura a mais sem ganho hoje.

`aparelho_id` é gerado uma vez por tablet e guardado junto do acesso. Serve para rastrear a origem
de cada entrevista e para achar tudo de um aparelho que deu problema.

A transcrição já vive dentro de `respostas[perguntaId].texto`; a tabela `audios` não a duplica.

`recebida_em` existe porque o relógio do tablet não é confiável. Consolidado e auditoria usam o
relógio do servidor; `alterada_em` serve apenas para decidir qual versão vence.

## Acesso

| Quem | `entrevistas` / `audios` | bucket `audios` | `entrevistadores` |
|---|---|---|---|
| Entrevistador | insere e atualiza só as próprias (`entrevistador_id = auth.uid()`); lê só as próprias | sobe e lê só na pasta do próprio id | lê só o próprio registro |
| Coordenador | lê todas; não edita | lê todas | lê todos |
| Anônimo | nada | nada | nada |

O papel mora em `entrevistadores.papel`, e o coordenador preenche essa tabela ao criar a conta no
painel do Supabase. Uma conta do Auth sem registro em `entrevistadores` não envia nada: conta criada
por engano, ou vazada, não chega ao dado.

A gravação passa por duas funções, não por `upsert` direto do cliente:

- `receber_entrevista(entrevista jsonb)` grava com `entrevistador_id = auth.uid()` — o tablet não
  escolhe de quem é a entrevista — e só sobrescreve se o `alterada_em` recebido for mais novo que o
  gravado. Um tablet com relógio atrasado não apaga uma versão mais nova.
- `registrar_audio(...)` roda depois do upload concluído no Storage, para que nenhuma linha aponte
  para arquivo que não existe.

## Conta do entrevistador

A tranca de hoje tem dois estados: primeiro acesso (nome + PIN) e entrar (PIN). Passa a ter:

1. **Primeiro acesso num tablet novo** — e-mail e senha da conta que o coordenador criou. O app
   confirma no Supabase, o que exige sinal uma única vez, e então a pessoa cria o PIN de 4 números.
   O nome deixa de ser digitado: vem de `entrevistadores.nome`.
2. **Todo dia** — só o PIN, com ou sem sinal, igual a hoje. A sessão do Supabase fica guardada no
   aparelho e se renova sozinha quando há rede.
3. **Sessão perdida** (conta desativada ou revogada) — o app continua abrindo com o PIN e a pessoa
   segue entrevistando. O envio para e a tela inicial pede para entrar de novo. Perder a conta nunca
   tranca o trabalho de campo.

O PIN continua sendo tranca de tela, com a mesma lógica e o mesmo formato gravado de hoje. Quem já
tem acesso criado não recadastra nada, e o código de 4 números continua valendo.

## O envio

Arquivo novo `lib/sincronizar.mjs`, no mesmo espírito de `lib/transcrever.mjs`: anota o que falta e
dispara sozinho quando a rede volta.

`salvarEntrevista` passa a carimbar `alteradaEm` em toda gravação. O sync roda ao abrir o app, no
evento `online` e ao concluir uma entrevista — nunca no meio de uma pergunta, porque o app não pode
esperar rede com o entrevistado na frente.

A ordem é entrevistas primeiro, áudios depois. O JSON tem poucos KB e sobe em qualquer sinal; o
áudio tem MB e espera Wi-Fi. Assim o consolidado central fica correto mesmo com os áudios ainda na
fila, que é o que interessa ao coordenador.

Wi-Fi é detectado por `navigator.connection.type` quando existe. Onde não existe — o Safari, que é
justamente o iPad — o app assume que não é Wi-Fi e oferece um botão "Enviar áudios agora" na tela
inicial. Gastar dado móvel de alguém sem avisar é pior que pedir um toque.

Falha de rede, 5xx ou sessão expirada registram e mantêm a pendência. Não há retry agressivo: a
próxima abertura do app ou a próxima volta de rede tenta de novo.

Na tela inicial, cada entrevista da lista ganha uma marca discreta — *no aparelho* ou *enviada* — e
um resumo em cima: "3 entrevistas ainda não enviadas · 12 áudios esperando Wi-Fi". Hoje o
entrevistador não tem como saber se pode limpar o tablet.

## A virada

Não há script de migração. A migração é a primeira abertura da versão nova com sinal.

Entrevista que já está no IndexedDB não tem `sincronizadaEm`, e a regra de pendência trata ausente
como "nunca subiu": tudo entra na fila naturalmente. Entrevista antiga também não tem `alteradaEm`;
para essas vale `iniciadaEm`.

Três consequências que precisam ser ditas a quem opera:

- Cada tablet precisa abrir a versão nova com sinal pelo menos uma vez. Não há como puxar do
  servidor o que nunca esteve lá; enquanto um tablet não abrir, o dado dele existe só nele.
- Tablet que já perdeu o dado não tem recuperação. Se houver ZIP exportado, dá para importar pelo
  lado do servidor, mas isso é trabalho separado.
- A ordem importa: publicar a versão nova, criar as contas, avisar a equipe para abrir o app no
  Wi-Fi antes de qualquer limpeza de aparelho.

## Falhas previstas

| Situação | Comportamento |
|---|---|
| Sem sinal | Entrevista normal; sobe depois. Só a marca "no aparelho" na lista. |
| Sessão expirada | Continua entrevistando com o PIN; envio para e a tela pede para entrar de novo. |
| Mesma entrevista sobe duas vezes | `receber_entrevista` compara `alterada_em`; a mais velha é ignorada. O id vem do tablet, então não há duplicata. |
| Relógio do tablet errado | Consolidado e auditoria usam `recebida_em`, do servidor. |
| Upload de áudio cortado | Arquivo órfão no Storage, sem linha; `registrar_audio` só roda depois do upload concluído e o próximo sync regrava por cima. |
| Áudio grande demais ou cota estourada | Falha registrada, pendência mantida, botão "Enviar áudios agora" tenta de novo. |
| Entrevista apagada no tablet | Marca `apagada_em` no servidor; o dado não some de lá. |
| Supabase fora do ar | Idêntico a estar sem sinal. |

O princípio atrás de todas: falha de servidor nunca atrapalha a entrevista.

## Critério de aceite

```bash
npm test
```

Esperado: os casos atuais continuam passando, mais `test/sincronizar.test.mjs` cobrindo, sem rede —

1. Entrevista alterada depois da última sincronização entra na lista de pendentes.
2. Entrevista antiga, sem `alteradaEm` nem `sincronizadaEm`, entra na lista.
3. Entrevista já sincronizada e não alterada depois fica fora.
4. Falha no envio mantém a pendência, sem marcar `sincronizadaEm`.
5. Entrevista apagada no aparelho vira marca de apagada, não some da fila.
6. Áudio pendente não entra na leva enviada fora do Wi-Fi.

```bash
CDP_PORT=9223 npm run validar
```

Esperado: as verificações atuais seguem passando, mais os cenários de sync em Chrome real —
entrevistar com a rede emulada offline, voltar a rede e ver a entrevista subir sozinha; sessão
expirada não travar o app nem a tranca; áudio permanecer pendente até o envio explícito.

Verificação contra o banco, obrigatória antes de qualquer dado real entrar:

- com a chave `anon` e uma sessão de entrevistador A, ler as entrevistas do entrevistador B devolve
  vazio;
- sem sessão nenhuma, ler `entrevistas` devolve vazio;
- uma conta do Auth sem registro em `entrevistadores` não consegue gravar;
- baixar um arquivo do bucket fora da própria pasta é negado.

Essa é a asserção mais importante deste spec. É dado de gente real.

## Fora de escopo

- **Painel do coordenador.** Vira spec próprio. Até lá o consolidado da equipe sai de uma view SQL
  no painel do Supabase, sobre o mesmo schema.
- **Baixar dado do servidor para o tablet.** O mesmo entrevistador em vários aparelhos exigiria
  sincronização nos dois sentidos e resolução de conflito. Um entrevistador, um tablet, continua
  valendo.
- **Importar ZIP antigo pelo servidor.** Recuperaria aparelho que já perdeu dado; é trabalho
  próprio.
- **Cifrar o IndexedDB.** Já registrado como pendência em `2026-09-05-validacao-robusta.md`. O
  servidor não muda nada disso: quem tem o aparelho continua lendo o banco pelo devtools.
- **Carga e concorrência.** Uma equipe pequena, um aparelho por pessoa.
