# CAIXA Fórmula de Impacto

Formulário de entrevista de campo para diagnóstico territorial. O entrevistador escolhe quem está na
frente dele e o aparelho monta na hora só as perguntas daquele agente — prefeito e secretários, ou
agricultor, quilombola e assentado cruzados com gênero e faixa etária.

Funciona sem sinal de celular: é onde a entrevista acontece.

```
$ npm test
# tests 31
# pass 31
# fail 0

$ npm run validar
40 verificações · 40 passaram · 0 falharam

$ npm run test:ui
9 aparelhos · 5 telas cada · telas em telas/
nenhum problema de usabilidade encontrado
```

## Como funciona

| Peça | Arquivo |
|---|---|
| Banco de perguntas com tags de perfil | `data/perguntas.json` |
| Montagem do formulário a partir do perfil | `lib/montar-formulario.mjs` |
| Persistência local (IndexedDB) | `lib/db.mjs` |
| Gravação de áudio e fila de transcrição | `components/GravadorAudio.jsx`, `lib/transcrever.mjs` |
| Exportação em ZIP e consolidado | `lib/exportar.mjs` |
| Funcionamento offline | `public/sw.js` |

Uma pergunta pertence a um perfil por tag, não por formulário separado:

```json
{
  "id": "jovem_permanencia",
  "texto": "Depois de terminar o ensino médio, você pretende continuar morando na zona rural?",
  "quando": { "faixa": ["jovem"] }
}
```

São 17 perfis possíveis e cada um recebe de 20 a 25 perguntas — um teste prende esse intervalo.

## Transcrição

O áudio é gravado sempre e fica salvo no aparelho. A transcrição roda no servidor
(`functions/api/transcrever.js`, Workers AI com `@cf/openai/whisper-large-v3-turbo`): 2min39 de
fala saem em cerca de 15 segundos, com pontuação, nos formatos que Safari, Chrome e Firefox gravam.

Rodar Whisper dentro do navegador foi tentado e descartado: o Safari não libera
`SharedArrayBuffer` sem cabeçalhos de isolamento, então o modelo usa uma thread só, leva minutos e
esquenta o aparelho — com qualidade pior, porque só um modelo pequeno cabe.

Sem sinal a gravação fica anotada como pendente e a transcrição acontece sozinha quando a internet
volta. O ZIP exportado traz os áudios originais de qualquer forma, e o `LEIAME.txt` de dentro dele
tem o comando para refazer tudo no computador com o `vox`.

## Validação

Três camadas, porque cada uma alcança o que a outra não vê.

| Camada | Comando | O que cobre |
|---|---|---|
| Unidade | `npm test` | montagem do formulário por perfil, exportação, fila de transcrição |
| Funcional em navegador | `npm run validar` | tranca, condicionais, persistência, gravação e transcrição de verdade, fila offline, service worker, banco recriado após perder um store, erros da API |
| Usabilidade | `npm run test:ui` | 9 aparelhos × 5 telas: alvo de toque, contraste, estouro horizontal |
| Agente na nuvem | `testsprite testlist run <id> --wait` | os mesmos fluxos vistos por quem não conhece o código (planos em `testsprite/planos/`) |

`npm run validar` precisa de um Chrome com microfone falso: é o que exercita
`getUserMedia` → `MediaRecorder` → `/api/transcrever` sem aparelho físico.

```bash
chrome --headless=new --remote-debugging-port=9223 \
  --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
  --use-file-for-fake-audio-capture=fala-em-portugues.wav
CDP_PORT=9223 npm run validar
```

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # motor de montagem e exportação
npm run build        # export estático em out/
npm run servir       # serve out/ como o Cloudflare Pages serve
npm run test:ui      # usabilidade em 9 aparelhos (precisa de npm run servir e Chrome com CDP)
npm run validar      # bateria funcional contra produção (precisa de Chrome com microfone falso)
```

## Publicação

```bash
npx wrangler login
npm run deploy
```
