# Entrega — 22 de setembro de 2026

Seis commits, em duas frentes independentes:

1. **Dois defeitos corrigidos** — prontos, testados, seguros de usar. Um deles travava o login.
2. **Sincronização com Supabase, começada e não terminada** — 2 tarefas de 10, mais o SQL escrito
   e nunca executado. Nada disso está ligado ao app: o build de hoje não fala com servidor nenhum.

Se você só quiser o que está pronto, leia a Parte 1 e pare.

---

## Parte 1 — Os dois defeitos corrigidos

### 1. A tranca travava calada quando o armazenamento falhava

**Commit:** `c2ff4ad` · **Arquivo:** `components/Tranca.jsx`

`cadastrar` e `entrar` eram `async` sem `try/catch`. As duas fazem coisas que podem falhar: gerar o
hash com `crypto.subtle`, gerar o sal com `crypto.randomUUID`, gravar no `localStorage`. Quando
qualquer uma estourava, o erro virava rejeição silenciosa — a pessoa tocava o botão e **não
acontecia nada**. Sem mensagem, sem log, app trancado.

Dois casos reais, os dois reproduzidos num Chrome de verdade:

| Cenário | Antes | Depois |
|---|---|---|
| `localStorage` estourando cota (aba anônima do Safari, dados do site bloqueados, armazenamento cheio) | nenhum aviso na tela, rejeição engolida | `"Não consegui guardar o acesso no aparelho…"` |
| App aberto por `http://` num IP da rede (ex.: `http://192.168.0.8:3111`) | nenhum aviso na tela | `"Este endereço não é seguro (precisa ser https ou localhost)…"` |

O segundo é traiçoeiro: fora de contexto seguro o navegador **não expõe** `crypto.subtle` nem
`crypto.randomUUID`. A tela de acesso monta normal e convida a digitar, mas nenhum código vai
funcionar nunca. Em produção (Cloudflare Pages, https) não acontece; acontece se alguém servir o
app num tablet pela rede local.

A correção envolve as duas funções em `try/catch` e escolhe a mensagem por `window.isSecureContext`.
É o mesmo cuidado que o `comecar()` de `app/page.jsx` já tinha para o IndexedDB — só faltava aqui.

**O que não mudou:** hash, sal, comparação e formato gravado. Quem já tem acesso criado **não
recadastra**, e o código de 4 números continua o mesmo.

### 2. `npm test` rodava zero testes no Windows e saía verde

**Commit:** `43019ca` · **Arquivo:** `package.json`

```
$ npm test
ℹ tests 0   ℹ pass 0   ℹ fail 0     ← exit code 0
```

O npm no Windows executa o script pelo `cmd.exe`, que não remove as aspas simples de
`node --test 'test/*.test.mjs'`. O Node recebia o caminho com as aspas dentro, não casava nada e
terminava com sucesso. Falso verde: quem rodasse `npm test` no Windows achava que tinha validado.

Trocado por aspas duplas. Passou de 0 para 32 testes na hora (hoje são 45).

### Como conferir a Parte 1

```bash
npm test          # 45 testes, 0 falhas — inclusive no Windows
npm run build     # compila e exporta
```

Para ver o defeito do login de perto, sirva o build e abra pelo IP da rede em vez de localhost:
antes da correção o botão morria em silêncio; agora aparece a mensagem.

---

## Parte 2 — Sincronização com Supabase (incompleta)

### Por que isso existe

Hoje a entrevista existe num lugar só: o IndexedDB do tablet que a gravou. Não há cópia. Tablet
perdido, "limpar dados do site", ou o Safari apagando o armazenamento de um site que ficou sete dias
sem uso levam junto o trabalho de campo de um dia. E o consolidado é sempre parcial, porque cada
aparelho só soma o que ele mesmo coletou.

O desenho está em **`specs/2026-09-18-sincronizacao-supabase.md`** e o passo a passo em
**`specs/2026-09-18-sincronizacao-supabase-plano.md`** (10 tarefas, com o código de cada uma).

### O que está no repositório

| Commit | O que entrou | Estado |
|---|---|---|
| `3388a6c` | `lib/aparelho.mjs` — `salvarEntrevista` passa a carimbar `alteradaEm` e `aparelhoId` | pronto, 5 testes |
| `4e4269c` | `lib/sincronizar.mjs` — decide quais entrevistas ainda não subiram | pronto, 8 testes |
| `c101e97` | `supabase/schema.sql` e `scripts/validar-rls.mjs` | **escrito, nunca executado** |
| `45c62a9` | `validar-rls.mjs` roda sem conta de teste, só com URL + chave anon | idem |

### Leia isto antes de rodar o SQL

**O `supabase/schema.sql` nunca foi executado contra um Postgres.** Não houve projeto Supabase para
aplicá-lo. A sintaxe não foi validada por nada além de leitura. Trate como rascunho revisado, não
como código que já rodou.

O mesmo vale para o `scripts/validar-rls.mjs`: a sintaxe JavaScript foi verificada
(`node --check`), mas ele nunca falou com um servidor.

### O app não depende disso

Confirmado nesta entrega:

- **Nenhum arquivo em `app/`, `components/` ou `lib/` importa `supabase`.**
- `@supabase/supabase-js` está em `dependencies`, mas só `scripts/validar-rls.mjs` o usa — **não
  entra no bundle do site** (conferido em `out/_next/static/chunks` depois do build).
- O app continua funcionando offline exatamente como antes, com ou sem servidor.

**Um efeito colateral que vale saber:** toda entrevista salva agora carrega dois campos novos,
`alteradaEm` e `aparelhoId`. Eles aparecem no `entrevistas.json` dentro do ZIP exportado. O
`entrevistas.csv` **não** muda, porque monta as colunas explicitamente a partir do banco de
perguntas.

### Onde pegar o fio

O plano para na **Tarefa 3**, que precisa de um projeto Supabase de verdade:

1. Criar o projeto e um bucket **privado** chamado `audios`.
2. Rodar `supabase/schema.sql` no SQL Editor.
3. `SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run validar:rls` → esperado 6 verificações passando.
4. Com duas contas (`CONTA_A/SENHA_A`, `CONTA_B/SENHA_B`), o mesmo comando roda mais 6 e prova que
   um entrevistador não lê nem sobrescreve o dado do outro.

Da Tarefa 4 em diante (cliente, login com conta, envio, áudios, tela, bateria funcional) o plano tem
o código pronto para colar, passo a passo.

### Três armadilhas que o plano já documenta

Foram encontradas na revisão do próprio plano e estão escritas lá, mas repito porque custam tempo:

- **`apagarEntrevista` apaga do IndexedDB na hora.** Para marcar `apagada_em` no servidor é preciso
  separar *marcar* de *remover* — senão a entrevista some antes de conseguir avisar. É a Tarefa 8.
- **Áudio precisa de `enviadoEm` gravado localmente.** Sem isso, cada sync re-sobe os mesmos
  megabytes, no plano de dados do entrevistador.
- **Mexer na primeira tela da tranca quebra `passarPelaTranca`** em `scripts/cdp.mjs`, e com ela
  `npm run validar` e `npm run test:ui` juntos. A Tarefa 5 tem o conserto.

---

## Achados não corrigidos

Encontrados na validação, deixados de fora de propósito:

- **`app/page.jsx:63`** repete `"acesso-formula-impacto"` como literal em vez de importar o `CHAVE`
  de `Tranca.jsx:7`. Renomear a chave num lugar só faz o nome do entrevistador sumir das
  entrevistas, sem quebrar nada visível.
- **O README anuncia 31 testes.** Eram 32 antes desta entrega, são 45 agora.
- **Não há freio de tentativas no PIN** — 12 códigos errados em 1,6 s, sem atraso nem bloqueio. Um
  PIN de 4 dígitos se esgota em minutos por script. Isso é **coerente com o que o código declara**
  (o comentário em `Tranca.jsx:10` e o texto da tela dizem que a tranca é para tablet passando de
  mão em mão, não para proteger dado). Fica registrado, não tratado como defeito.
- **Não existe caminho no app para redefinir um código esquecido.** A tela diz que "quem tiver
  acesso ao navegador consegue apagá-lo", mas na prática isso é limpar dados do site — o que leva as
  entrevistas junto.

## O que não foi rodado

- **`npm run validar`** (40 verificações) — aponta para produção e exige Chrome com microfone falso.
- **`npm run comparar`** — precisa do Piper instalado (~380 MB, fora do git).
- **`npm run test:ui`** — precisa de `npm run servir` mais Chrome com CDP.

Nenhum dos três foi afetado pelas mudanças desta entrega, mas nenhum foi executado para confirmar.

## Como os commits chegaram aqui

Feitos localmente por `cauedev30`, que tem `pull` mas **não tem `push`** neste repositório. Nada foi
enviado. Para integrar: adicionar como colaborador, ou receber via fork + pull request.
