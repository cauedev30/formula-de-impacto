# App mais redondo

## Intenção
O entrevistador não perde mais dado: a duração do áudio sai certa, o ZIP leva só a gravação que vale,
a transcrição pendente chega mesmo com a tela fechada e não apaga o que foi digitado, e a resposta
não salva é gravada ao sair da tela. Em volta disso: aviso de dado só no aparelho, limite de pedidos na
API, gênero do poder público, aviso de idade fora da faixa, filtros combinados e importação de outro tablet.

## Critério de aceite
- `npm test` — esperado `# fail 0`, com testes novos de `audiosDaResposta`, `juntarTranscricao`,
  erro `definitivo`, `limparOrfas` com id fora do banco, `idadeForaDaFaixa`, `lerExportacao` e
  `juntarEntrevistas`.
- `npm run build` — esperado `out/index.html`.
- `npx wrangler pages dev out` e `BASE_URL=http://localhost:8788 CDP_PORT=9223 npm run validar` —
  esperado 0 falhas, com os cenários `11-duracao` (ficha não mostra `00:00`) e `12-fila-recarregada`
  (texto chega depois de recarregar e a fila esvazia).

## Fora de escopo
- Apagar do IndexedDB o áudio descartado ao regravar.
- Persistir no aparelho as entrevistas importadas de outro tablet.
- Turnstile ou outro desafio anti-robô na API.
- Deploy: fica para depois do ok do usuário.
