# Contexto do projeto (para sessões Claude)

App pessoal single-user (Next.js 15, Vercel Hobby, free tier). Dados via
Freddy MCP (Garmin), Intervals.icu e strava-lab. Coach IA: Groq Llama 3.3 70B.
Utilizador: corredor em Matosinhos/Porto, objetivo maratona sub-3h.

## Convenções de trabalho
- Anotar afirmações no código com [Certo]/[Provável]/[Suposição].
- Bug em produção = capturar fixture + escrever teste que o reproduz ANTES do fix.
- Mensagens de commit: o quê + porquê, 3-6 linhas. Nunca "alterações X".
- Diffs mostrados ao utilizador ANTES de commit. Sem scope creep: alterações
  fora do pedido são listadas, não aplicadas.
- Atualizar este ficheiro no fim de cada bloco de trabalho.

## Factos técnicos confirmados
- [Certo] O Freddy devolve TEXTO humano, não JSON — parser em lib/freddy/data-adapter.ts
  (extração de blocos `raw: {...}` por chavetas balanceadas).
- [Certo] Unidades: summarizedActivity_elevationGain ÷100; calories kJ→kcal ÷4.184;
  recoveryTime em SEGUNDOS.
- [Certo] Freddy: ~3 pedidos concorrentes máx, 429 acima. Semáforo global em
  lib/freddy/limiter.ts (MAX_CONCURRENT=2, retry só em 429) é a ÚNICA coordenação.
- [Certo] Cliente MCP é SINGLETON (lib/freddy/client.ts) — NUNCA chamar close()
  por chamada (regressão histórica: destruía o singleton, reconexão por pedido).
- [Certo] Algumas métricas devolvem vazio por start/end mas dados por days —
  fallback legacy-days no data-adapter. Sentinels só após o fallback.
- Cache por (métrica, data) em lib/freddy/cache.ts; datas passadas imutáveis;
  CACHE_VERSION invalida tudo (incrementar se o formato parseado mudar).
- [Certo] Localização: cookie browser geo > env WEATHER_* > geo-IP > default.
  Geo-IP da Vercel resolve para o interior (erro de 16°C confirmado) — nunca
  promover geo-IP na cadeia. Coach TEM de receber o mesmo geo hint do cookie.
- [Certo] HRV: fonte única computeHrvDeviation (lib/utils/hrv.ts) — "atual" =
  último dia com hrv não-nulo; baseline = média 30d excluindo esse dia.
  Dashboard faz UM fetch de wellness partilhado (loadReadinessAndRecovery).
- [Certo] TSB/CTL/ATL de decisão (card e coach) vêm do ÚLTIMO dia < hoje
  (getPreviousDayWellness) — convenção PMC + imuniza contra instabilidade do
  registo de hoje. Causa exata do sintoma "push altera TSB" não confirmada;
  hipótese de carga planeada no wellness testada duas vezes, negativa.
- [Certo] Decoupling só em execução CONTÍNUA (isPaceContinuous, CV<0.15) —
  em todos os ramos, com ou sem prescrição. Intervalado → null, badge ausente.
- [Certo] A página Running NÃO tem lista de atividades (removida a pedido).
  ActivityDetailPanel é alcançável via personal-records-tiles e via
  last-workout-card (dashboard, abaixo do readiness-hero).
  [Certo] Sinais da manhã (sono/HRV/RHR/bateria) leem getMorningWellness (registo de hoje = noite passada); carga (CTL/ATL/TSB) lê getDecisionWellness (ontem). NUNCA aplicar getDecisionWellness a sinais da manhã — regressão histórica de sobrecorreção.
  [Certo] NUNCA média aritmética de paces por amostra — pace agregado = distância total / tempo total (samples 1Hz: média harmónica). Viés confirmado: +15s/km num treino real.

## Testes e CI
- Vitest, 77 testes; CI em .github/workflows/ci.yml (npm ci + typecheck + lint + test).
- Fixtures REAIS em tests/fixtures/ — dados fisiológicos, .gitignore, NUNCA
  commitar. CI corre contra tests/fixtures-synthetic/ (estrutura real, valores falsos).
- tools/capture-fixtures.ts recaptura output MCP real (npm run fixtures:capture, local).
- [Certo] @emnapi/* são devDeps DIRETAS de propósito: npm em Windows omite
  optional deps transitivas do lockfile e o npm ci em Linux rebenta. Não "limpar".
- npm audit: 2 moderate = postcss embutido no Next 15 (build-time, sem exposição
  real); só sai no Next 16. NUNCA npm audit fix --force (propõe downgrade p/ Next 9).

## Dúvidas conhecidas
- Mover ReadinessCardData/RecoveryCardData para lib/types/ e apagar os componentes
  ReadinessCard/RecoveryCard (mortos desde o readiness-hero; ficheiros sobrevivem
  só pelos tipos).
- Composto de readiness: evoluir comparação de HRV para média 7d vs baseline 30-60d
  (uma noite vs média é ruidoso). Iteração, não bug.
- Split de lib/freddy/metrics.ts (ainda ~2000 linhas) em módulos.


## Roadmap
- Feitos: 1 (cache), 2 (limpeza), 3 (testes+CI), 4 (auth), 5+7 (memória do coach
  prescrito vs executado com decoupling e guardrails), 6 (80/20 semanal),
  card Último Treino, fixes de localização/AQI/HRV/TSB.
- PRÓXIMO: 8 (card sub-3h). Depois: 9 (ramp/monotony), 10 (modelo p/ prescrição).