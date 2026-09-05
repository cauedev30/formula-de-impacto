# CAIXA Fórmula de Impacto

Formulário de entrevista de campo para diagnóstico territorial. O entrevistador escolhe quem está na
frente dele e o aparelho monta na hora só as perguntas daquele agente — prefeito e secretários, ou
agricultor, quilombola e assentado cruzados com gênero e faixa etária.

Funciona sem sinal de celular: é onde a entrevista acontece.

```
$ npm test
# tests 23
# pass 23
# fail 0

$ npm run test:ui
7 aparelhos · 5 telas cada · telas em telas/
nenhum problema de usabilidade encontrado
```

## Como funciona

| Peça | Arquivo |
|---|---|
| Banco de perguntas com tags de perfil | `data/perguntas.json` |
| Montagem do formulário a partir do perfil | `lib/montar-formulario.mjs` |
| Persistência local (IndexedDB) | `lib/db.mjs` |
| Gravação de áudio e transcrição no aparelho | `components/GravadorAudio.jsx`, `lib/transcrever.mjs` |
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

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # motor de montagem e exportação
npm run build        # export estático em out/
npm run servir       # serve out/ como o Cloudflare Pages serve
npm run test:ui      # usabilidade em 7 aparelhos (precisa de npm run servir e Chrome com CDP)
```

## Publicação

```bash
npx wrangler login
npm run deploy
```
