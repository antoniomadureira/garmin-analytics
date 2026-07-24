# Contexto do projeto (para sessões Claude)

App pessoal single-user (Next.js 15, Vercel Hobby, free tier). Dados via
Freddy MCP (Garmin), Intervals.icu e strava-lab. Coach IA: Groq Llama 3.3 70B.
Utilizador: corredor em Matosinhos/Porto, objetivo Maratona de Lisboa
10/10/2026 sub-3h (4:15/km). Plano principal: Kiprun Pace (evidência empírica
do utilizador); o coach da app é AVALIADOR/vigia, não planeador primário.

## Convenções de trabalho
- Anotar afirmações no código com [Certo]/[Provável]/[Suposição].
- Bug em produção = capturar fixture real + teste que o reproduz ANTES do fix.
- Fonte de dados nova = fixture REAL capturada primeiro (fixtures:capture);
  sintéticas só derivadas de reais.
- "Feito" = pushed + Actions verde + CONFIRMADO NO ECRÃ. Relatório de agente
  ≠ estado do repo (verificar git log). Build verde ≠ runtime são: páginas
  com alterações de render abrem-se em dev antes do push.
- typecheck + build LOCAIS antes de cada push (Vercel não corre typecheck
  estrito nos testes; o CI corre).
- Produção partida: rollback primeiro (Vercel → Deployments → Promote),
  diagnóstico depois.
- Mensagens de commit: o quê + porquê, 3-6 linhas. Nunca "alterações X".
  Antes de git commit, reler esta secção.
- Diffs mostrados ao utilizador ANTES de commit. Sem scope creep: alterações
  fora do pedido são listadas, não aplicadas.
- Atualizar este ficheiro no fim de cada bloco de trabalho.
- Itens desenhados no chat entram na secção PENDENTE no próprio dia; um item
  só sai quando confirmado no ecrã.

## Factos técnicos confirmados
- [Certo] O Freddy devolve TEXTO humano, não JSON — parser em
  lib/freddy/data-adapter.ts (blocos `raw: {...}` por chavetas balanceadas).
- [Certo] Unidades: summarizedActivity_elevationGain ÷100; calories kJ→kcal
  ÷4.184; recoveryTime em SEGUNDOS.
- [Certo] Freddy: ~3 pedidos concorrentes máx, 429 acima. Semáforo global em
  lib/freddy/limiter.ts (MAX_CONCURRENT=2, retry só em 429) é a ÚNICA
  coordenação de concorrência — sem throttles locais.
- [Certo] Cliente MCP é SINGLETON (lib/freddy/client.ts) — NUNCA chamar
  close() por chamada (regressão histórica: destruía o singleton).
- [Certo] Algumas métricas devolvem vazio por start/end mas dados por days —
  fallback legacy-days no data-adapter. Sentinels só após o fallback.
- Cache por (métrica, data) em lib/freddy/cache.ts; datas passadas imutáveis;
  CACHE_VERSION invalida tudo (incrementar se o formato parseado mudar).
- [Certo] Records Strava: cache SEM TTL invalidada por latestId do summary
  (lib/strava-lab/records-cache.ts) — a paginação de 1000 atividades só corre
  com atividade nova.
- [Certo] Localização: cookie browser geo > env WEATHER_* > geo-IP > default.
  Geo-IP da Vercel resolve para o interior (erro de 16°C confirmado). Coach
  TEM de receber o mesmo geo hint do cookie.
- [Certo] Wellness — dois "dias": sinais da manhã (sono/HRV/RHR/bateria) de
  getMorningWellness (registo de hoje = noite passada); carga (CTL/ATL/TSB)
  de getDecisionWellness (último dia < hoje, convenção PMC). NUNCA aplicar
  getDecisionWellness a sinais da manhã (regressão histórica de
  sobrecorreção).
- [Certo] HRV: fonte única computeHrvDeviation (lib/utils/hrv.ts) — "atual" =
  último dia com hrv não-nulo; baseline = média 30d excluindo esse dia.
  Dashboard faz UM fetch de wellness partilhado.
- [Certo] NUNCA média aritmética de paces por amostra — pace agregado =
  distância total / tempo total (média harmónica). Viés confirmado: +15s/km
  num treino real.
- [Certo] Monotonia (Foster) calcula-se sobre a CARGA DIÁRIA BRUTA (atlLoad
  dos raws, zeros incluídos), nunca sobre ATL suavizado (dava 10.40,
  impossível). [Provável] atlLoad em falta num dia conta como 0 e subestima —
  vigiar se o valor parecer baixo numa semana pesada.
- [Certo] Coach — regra de ouro: TODA a aritmética/comparação/interpretação é
  feita em código; o LLM cita valores pré-formatados (desvio com palavra
  direcional, pace via secPerKmToMinSec, semanas/fase da prova calculadas em
  goal-store.ts). Instrução nova entra SEMPRE também no EXEMPLO do system
  prompt — o Llama imita exemplos, ignora regras.
- [Certo] Coach — memória: trackDate corre em savePrescription E
  saveExecution; histórico injetado no FIM do contexto; citação do último
  treino é FORMATO obrigatório ("📊 Último treino: ..."), não instrução.
  rawBlock guardado ao lado do parseado (fixture à distância de um GET).
- [Certo] Coach — modos: prescribe (default) / evaluate (campo "Plano de
  hoje" OU evento ICU futuro → veredicto ✅/⚠️/🛑, sem bloco ICU) / review
  (plano + atividade executada hoje → desvios calculados em código).
  extractPlanFromMessage promove mensagens com padrão de prescrição.
- [Certo] Coach — filosofia 80/20: NUNCA comparar pace de treino
  fácil/volume com o pace de maratona (fáceis são propositadamente
  45-90s/km mais lentos). Comparação é contra o prescrito ou a faixa do
  TIPO de treino.
- [Certo] Coach — segunda sessão no mesmo dia: defeito é descanso; hora do
  treino de hoje entra no contexto; factos ausentes não se afirmam.
- [Certo] TSB/CTL/ATL de decisão vêm do último dia < hoje. Causa exata do
  sintoma "push altera TSB" não confirmada; hipótese de carga planeada
  testada duas vezes, negativa.
- [Certo] Decoupling só em execução CONTÍNUA (isPaceContinuous, CV<0.15) —
  em todos os ramos. Intervalado → null, badge ausente.
- [Certo] Interpretações no UI (ramp/monotonia/decoupling/sono): texto por
  LIMIARES EM CÓDIGO (constantes nomeadas), só visível em atenção/alerta;
  síntese quando ramp E monotonia ambos ≥atenção. NUNCA texto do LLM.
- [Certo] Previsão de maratona: Garmin se <14d, senão Riegel sobre records
  do Freddy (data = corrida real; janela 70d→180d com aviso; filtro de
  representatividade pace < goal×1.25×0.90; distância mais longa com
  penalização de antiguidade >45d). checkIcuConsistency valida texto vs
  bloco ICU (só distâncias — treinos 100% por tempo passam sem verificação
  real) + steps de distância com pace + não misturar HR/Pace + hasIntervals.
- [Certo] Fases do sono: estimadas por atigrafia — margem de erro
  significativa vs polissonografia, sobretudo REM. O rodapé de humildade no
  card é DELIBERADO (não remover); alertas valorizam tendências (3+ noites).
  Fases NÃO entram no composto (sleepScore já as pondera — dupla contagem).
- [Certo] RSC: Server Components NUNCA passam funções como props a Client
  Components — passar identificador string, resolver no client. O build NÃO
  apanha; só a página aberta (regressão histórica: sleepHmHtick partiu
  /dashboard/sleep em produção).
- [Certo] Dev local com 404 em TODOS os _next/static/* ou "Failed to read
  source code" de ficheiros existentes = ambiente corrompido (cache .next
  mista ou processo node pendurado), NÃO bug de código. Protocolo:
  Get-Process node | Stop-Process -Force → Remove-Item -Recurse -Force
  .next → Test-Path do ficheiro acusado → npm run dev. Não reverter commits.
- [Certo] .env.local de teste precisa de STRAVA_LAB_API_KEY para zonas/
  splits do detalhe; AUTH_BYPASS=1 (só fora de produção) salta o login.

## Limitações de terceiros (documentadas — NÃO investir em workaround)
- [Certo] ICU→Garmin, multiple targets: misturar HR e Pace no mesmo workout
  → Garmin apaga todos os targets. Workouts de corrida são pace-only
  NUMÉRICO ("5:00-5:15/km Pace"); nunca "Zx Pace" (→ null-null se zonas ICU
  vazias), nunca sufixo HR. Fontes: forum.intervals.icu/t/130238, t/118130.
- [Certo] ICU→Garmin, repeat blocks (Nx): chegam ao relógio como NOTA de
  texto (bug do FIT generator do ICU, sem ETA — não injeta intensity nos
  steps de repeat). Contínuos chegam estruturados. Aviso determinístico na
  UI quando hasIntervals. Fontes: t/124473, t/130465.
- [Certo] Kiprun Pace: sem API; ICU↔Garmin unidirecional (ICU→Garmin) —
  treinos Kiprun invisíveis programaticamente. Integração via campo manual
  "Plano de hoje".
- npm audit: 2 moderate = postcss embutido no Next 15, sem exposição real;
  só sai no Next 16. NUNCA npm audit fix --force (propõe Next 9).
- [Certo] @emnapi/* são devDeps DIRETAS de propósito (npm em Windows omite
  optional deps transitivas do lockfile; npm ci em Linux rebenta). Não
  "limpar".

## Testes e CI
- Vitest — contagem: ver o último run do CI (números fixos aqui apodrecem;
  referência: ~394 em 2026-07-15). CI: npm ci + typecheck + lint + test.
- Fixtures REAIS em tests/fixtures/ — dados fisiológicos, .gitignore, NUNCA
  commitar. CI corre contra tests/fixtures-synthetic/ (estrutura real,
  valores falsos). tools/capture-fixtures.ts recaptura (local).

## Dívidas conhecidas
- Mover ReadinessCardData/RecoveryCardData para lib/types/ e apagar os
  componentes ReadinessCard/RecoveryCard (mortos; ficheiros sobrevivem só
  pelos tipos).
- Composto de readiness: evoluir HRV para média 7d vs baseline 30-60d (uma
  noite vs média é ruidoso). Iteração, não bug.
- Split de lib/freddy/metrics.ts (~2000 linhas) em módulos.
- Evaluate mode: veredicto ⚠️ "Ajusta" não empurra o treino ajustado ao
  relógio — evolução futura se os ⚠️ forem frequentes na fase específica.
- checkIcuConsistency só valida distâncias — treinos 100% por tempo reportam
  consistente sem verificação real.
- Erro cru de STRAVA_LAB_API_KEY exposto ao cliente numa rota — passar por
  humanizeError.

## PENDENTE (itens desenhados, aguardam implementação ou confirmação)
- (vazio em 2026-07-15 — tudo confirmado no ecrã)

## Roadmap
- Feitos: 1 (cache), 2 (limpeza), 3 (testes+CI), 4 (auth), 5+7 (memória do
  coach + decoupling + guardrails + formato 📊 validado em produção), 6
  (80/20 semanal), 8 (objetivo de prova + card Rumo ao sub-3h + Riegel
  representativo), 9 (ramp/monotony com interpretações), evaluate/review
  modes, integração Kiprun (campo manual), hipnograma + alertas de sono
  (2026-07-15), consistência ICU, cards Último Treino, fixes de
  localização/AQI/HRV/TSB/pace/performance (dashboard 16s→3s).
- Item 10 (modelo melhor p/ prescrição): ADIADO indefinidamente — os
  defeitos do Llama foram resolvidos por engenharia (aritmética em código,
  formatos obrigatórios, exemplos); reavaliar só se o caderno de faltas o
  justificar.
- Estado: bloco de construção FECHADO. Próximos eventos são de treino
  (teste Kiprun 19/07: 30' @ 5:25 + 6' @ 3:30 + 10' @ 5:25; 10K de controlo
  ~fim de julho; experimento REM: horário de deitar fixo 1 semana). Sessões
  futuras: fixes do caderno de faltas do utilizador — NÃO propor features
  novas por iniciativa própria.