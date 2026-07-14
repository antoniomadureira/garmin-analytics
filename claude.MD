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
  - [Certo] Objetivo de prova em coach:goal (Redis, sem TTL) — Maratona de Lisboa
  2026-10-10, 3:00:00 (4:15/km). Semanas/fase calculadas em código
  (lib/coach/goal-store.ts), NUNCA pedidas ao modelo. Editar via npm run goal:set.
- [Certo] Memória do coach: trackDate corre em savePrescription E saveExecution;
  histórico injetado no FIM do contexto; citação do último treino é FORMATO
  obrigatório ("📊 Último treino: ..."), não instrução. Convenção: instrução nova
  ao coach entra sempre também no EXEMPLO do system prompt — o Llama imita
  exemplos, ignora regras.
- [Certo] Consistência texto vs bloco ICU: checkIcuConsistency (warning UI +
  log [coach:consistency], estados consistente/inconsistente/unverifiable).
  [Provável] Só valida DISTÂNCIAS — treinos 100% por tempo reportam consistente
  sem verificação real.
- [Certo] Segunda sessão no mesmo dia: defeito é descanso; hora do treino de
  hoje entra no contexto; factos ausentes do contexto não se afirmam (regra
  anti-confabulação no system prompt).
- [Certo] Desvio de pace: paceDeviationLabel (workout-history.ts) calcula vs o
  limite mais próximo do range (minSecPerKm se mais rápido, maxSecPerKm se mais
  lento) e produz "Xs mais rápido/lento que o alvo" ou "dentro do alvo". Campo
  legado paceVsTargetSecPerKm (vs ponto médio) ignorado no display — era ambíguo
  (bug: "-23s/km" lido como défice de velocidade). Convenção: aritmética e
  comparações de pace nunca são do Llama — modelo cita texto pré-formatado.
  [Certo] Coach linha → ajuste — 3 casos no system prompt: (a) desvio presente
  nos dados → citar literalmente; (b) treino fácil/volume/recuperação sem alvo
  ou "treino sem prescrição" → caracterizar pelo TIPO ("pace de volume correto"),
  NUNCA comparar contra 4:15/km (race pace) — treinos fáceis são 45-90s/km mais
  lentos por princípio 80/20; (c) "dentro do alvo" → citar. Bug anterior: o Llama
  comparava 4:59/km vs 4:15 (race pace) e escrevia "44s mais lento que o alvo".
  Diagnóstico timing Garmin→Freddy: se [coach:history] vazio na 1ª chamada e
  preenchido na 2ª → timing (esperado, não bug); se presente e ignorado → confabulação (reportar).

- [Certo] Previsao de maratona (card Rumo ao sub-3h): Garmin se fresco (<14d);
  Riegel (lib/analysis/race-prediction.ts, T2=T1*(D2/D1)^1.06) sobre melhor
  esforco Freddy <=70d em HM>10K>5K, caso contrario (180d com aviso no footer).
  getRacePredictions REESCRITO (2026-07-10): usava parseQueryMetricsText (so
  le raw:) — race predictions sao escalares sem raw:, logo devolvia {} sempre.
  Fix: queryRawText + extractValuesByDate. Lag Garmin confirmado: 19 dias.
  days:30 cobre o lag; check de frescura (<14d) na API route.
  Riegel usa FreddyDataService.getPersonalRecords(180) (data = data da corrida
  real, nao PR all-time); strava-lab /records removido do dashboard render.
  Card e API route: app/api/dashboard/race-goal/route.ts (client-side fetch).
  CANDIDATES: HM>10K>5K (15K removido — nao coberto pelo Freddy).
  getCachedPersonalRecords: TTL 24h adicionado aos kv.set.
  selectRiegelInput REESCRITO (2026-07-11): bug — HM a 5:08/km (treino fácil,
  69d atrás) vencia sobre 10K a 3:46/km (118d atrás, fora da janela 70d) →
  previsão 3:45 errada. Fix: filtro de representatividade (pace < goalPace ×
  1.25 × 0.90; goalPace × 1.25 ≈ Z2 proxy); recolhe TODOS os qualificados por
  categoria (não sai no 1º match); prefere distância maior mas penaliza
  antiguidade (se o topo for >45d mais velho que o seguinte, troca). Com o
  fix: 10K a 3:46 qualifica na janela 180d (stale) → previsão ≈2:53.
- [Certo] Ramp rate (lib/analysis/training-stress.ts): consumido de wellness.rampRate
  (Intervals.icu, CTL/sem), NUNCA recalculado. Semáforo: <1.0 ok; 1.0-1.5 atenção;
  ≥1.5 sustentado 2+ semanas → alerta (verifica weekAgo com Date.UTC para evitar
  drift de timezone). Monotonia Foster: usa atlLoad (WellnessDay.atlLoad, impulso
  diário bruto do Intervals.icu, 0 em dias de descanso). Fix (2026-07-11): ATL EWMA
  direto → variância mínima → monotonia 10+. Inverso EWMA abandonado: fórmula
  Intervals.icu ≠ EWMA discreto k=7 (rest day dava L=16 em vez de 0). atlLoad
  disponível nos raws, extraído em getWellnessWeekly. >2.0 atenção, >2.5 alerta;
  <4 dias L>0 → lowData, sem veredicto. Integrado no card, coach, testes.
- [Certo] Gráfico de intensidade (getHrZonesWeekly): usa activity_icu_hr_zone_times
  (Intervals.icu, raw JSON {"zones":[Z0..Z6]}, sem atraso). Substituiu
  summarizedActivity_hrTimeInZone_* (Garmin) que tinha atraso ~30 dias — causa
  confirmada do "sem dados desde 15/6". Parser: extractIcuHrZonesByDate (exportado,
  testado). Formato lido com includeRaw:true; FreddyClient.queryRawText aceita
  includeRaw na interface.
  REGRESSÃO CORRIGIDA (2026-07-10): cachedQueryRawText nunca passava include_raw
  ao callTool — parser devolvia mapa vazio → zero barras. Fix: mcpArgs condicional +
  "|raw" na chave de cache. Fixture sintética icu-hr-zones.txt derivada de MCP real.
  Regra: parser para fonte nova só com fixture REAL capturada antes.

## Testes e CI
- Vitest, 367 testes; CI em .github/workflows/ci.yml (npm ci + typecheck + lint + test).
- Fixtures REAIS em tests/fixtures/ — dados fisiológicos, .gitignore, NUNCA
  commitar. CI corre contra tests/fixtures-synthetic/ (estrutura real, valores falsos).
- tools/capture-fixtures.ts recaptura output MCP real (npm run fixtures:capture, local).
- [Certo] @emnapi/* são devDeps DIRETAS de propósito: npm em Windows omite
  optional deps transitivas do lockfile e o npm ci em Linux rebenta. Não "limpar".
- npm audit: 2 moderate = postcss embutido no Next 15 (build-time, sem exposição
  real); só sai no Next 16. NUNCA npm audit fix --force (propõe downgrade p/ Next 9).
-  [Certo] Cards de carga/decoupling têm linha de interpretação por limiares em código  (training-stress.ts, PrescribedVsExecutedCard) — texto determinístico, NUNCA do LLM. Síntese quando ramp E monotonia ambos ≥atenção. Só visível em atenção/alerta.

- [Certo] Coach evaluate mode (lib/coach/evaluate.ts): quando o contexto tem
  [PLANO DO DIA], o system prompt é SYSTEM_PROMPT_BASE + SYSTEM_PROMPT_EVALUATE_SUFFIX
  e o modelo responde com veredicto ✅/⚠️/🛑 (código valida via extractEvaluateVerdict).
  Prioridade de fontes: campo manual (body.plannedWorkout) > GET ICU events para hoje
  (getPlannedWorkoutForDate, lib/intervals/client.ts) > nenhum (modo prescribe normal).
  Plano guardado em Redis via savePrescription em cada evaluate — memória funciona para
  treinos Kiprun sem ICU push. icuWorkout=null em evaluate mode (sem push button).
  ICU events fetch corre em paralelo com buildContextSummary para não aumentar latência.
  [Certo] Kiprun→Garmin→ICU: sync é UNIDIRECIONAL ICU→Garmin. Treinos Kiprun no
  calendário Garmin NÃO chegam ao ICU automaticamente. FONTE 2 (ICU events) cobre
  apenas eventos criados por nós (coach push) ou manualmente no ICU. Para treinos
  Kiprun usar FONTE 1 (campo manual).

## Dúvidas conhecidas
- Mover ReadinessCardData/RecoveryCardData para lib/types/ e apagar os componentes
  ReadinessCard/RecoveryCard (mortos desde o readiness-hero; ficheiros sobrevivem
  só pelos tipos).
- Composto de readiness: evoluir comparação de HRV para média 7d vs baseline 30-60d
  (uma noite vs média é ruidoso). Iteração, não bug.
- Split de lib/freddy/metrics.ts (ainda ~2000 linhas) em módulos.
[Provável] atlLoad em falta num dia isolado conta como carga 0 e subestima a monotonia — vigiar se o valor parecer baixo demais numa semana pesada.
[evoluçãp conhecida] Se os "Ajusta" se tornarem frequentes na fase específica, a iteração seguinte é: veredicto ⚠️/🛑 oferece um botão "push do treino ajustado" que substitui o evento.
- [Certo] ICU↔Garmin sync — limitação de múltiplos targets: o Garmin só
  aceita UM tipo de target por workout (Pace OU HR, nunca os dois). Misturar
  — ex: warmup "65% HR" com main set "5:00/km Pace" — resulta em "No targets"
  em todos os steps no relógio (bug confirmado por moderador ICU, sem ETA de fix;
  fonte: forum.intervals.icu/t/syncing-pace-hr-targets-to-garmin/130238).
  Fix: quando o contexto tem pace zones, todos os steps usam Pace (warmup/
  cooldown/recuperações em pace numérico; sessão em pace numérico ou zona Pace).
  HR% só quando não há pace zones no contexto. checkIcuConsistency detecta
  mistura automaticamente (hasMixedMetrics → warning [coach:consistency]).
- [Certo] ICU↔Garmin sync — blocos de repetição (Nx): workouts com blocos
  "6x"/"4x" chegam ao Garmin como NOTA DE TEXTO (sem steps executáveis no
  relógio), não como workout estruturado. Causa: o ICU não injeta campo
  intensity nos steps dentro de repeat blocks ao gerar o FIT file → Garmin
  recebe steps sem tipo e regride para nota. Workouts contínuos (Warmup/Main/
  Cooldown sem Nx) chegam como steps estruturados com pace correto.
  Bug ICU confirmado, sem ETA de fix; fontes: forum.intervals.icu/t/124473
  (steps como "Other"), forum.intervals.icu/t/130465 (pace range → notes only).
  Deteção: parseIcuBlockStats.hasIntervals propagado para ConsistencyResult;
  route.ts injeta aviso no consistencyWarning quando hasIntervals=true.
  UI: aviso determinístico ao lado do botão "Enviar para Intervals" — NUNCA
  via LLM. O pace está sempre no texto do treino — utilizador navega por ele.

## Roadmap
- Feitos: 1 (cache), 2 (limpeza), 3 (testes+CI), 4 (auth), 5+7 (memória do coach
  prescrito vs executado, decoupling, guardrails, formato 📊 validado em produção),
  6 (80/20 semanal), 8 (objetivo de prova + card Rumo ao sub-3h), 9 (ramp rate +
  monotony/strain), card Último Treino, consistência ICU, fixes de
  localização/AQI/HRV/TSB/pace harmónico, coach evaluate mode (campo Plano de hoje
  + FONTE 2 ICU events, veredictos ✅/⚠️/🛑, prescrição guardada em Redis).
- Depois: 10 (modelo p/ prescrição), 11 (encriptar tokens + LICENSE + template OSS),
  12 (hipnograma, race readiness 12 semanas).
