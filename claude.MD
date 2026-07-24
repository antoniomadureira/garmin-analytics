# Contexto do projeto (para sessões Claude)

App pessoal single-user (Next.js 15, Vercel Hobby, free tier). Dados via
Freddy MCP (Garmin), Intervals.icu e strava-lab. Coach IA: Groq Llama 3.3 70B.
Utilizador: corredor em Matosinhos/Porto, objetivo Maratona de Lisboa
10/10/2026 sub-3h (4:15/km). Plano principal: Kiprun Pace (evidência empírica
do utilizador); o coach da app é AVALIADOR/vigia, não planeador primário.

## Convenções de trabalho
- Anotar afirmações no código com [Certo]/[Provável]/[Suposição].
- Bug em produção = capturar fixture real + teste que o reproduz ANTES do fix.
- INSTRUMENTAÇÃO ANTES DE HIPÓTESES: quando um sintoma não tem causa óbvia,
  adicionar log permanente e reproduzir, em vez de teorizar. Regressão
  histórica: o "botão de push desaparecido" esteve 2 dias por explicar e os
  logs resolveram-no em minutos — revelando DOIS bugs diferentes.
- Fonte de dados nova = fixture REAL capturada primeiro (fixtures:capture);
  sintéticas só derivadas de reais.
- "Feito" = pushed + Actions verde + CONFIRMADO NO ECRÃ. Relatório de agente
  ≠ estado do repo (verificar git log). Build verde ≠ runtime são: páginas
  com alterações de render abrem-se em dev antes do push.
- typecheck + build LOCAIS antes de cada push (Vercel não corre typecheck
  estrito nos testes; o CI corre).
- Produção partida: rollback primeiro (Vercel → Deployments → Promote),
  diagnóstico depois.
- Antes de declarar "limitação de terceiros", esgotar a CONFIGURAÇÃO da
  conta do utilizador (zonas, thresholds, settings da plataforma).
- Um guardrail que dispara em casos corretos treina o utilizador a ignorá-lo.
  Preferir estado "unverifiable" (silencioso, logado) a warning sempre que a
  extração não for de confiança.
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
- [Certo] DUAS caches independentes: per-date (freddy:cache:vN:...) e
  RAWTEXT (freddy:rawtext:v1:..., TTL 15min, SEM versionamento). Um DEL na
  primeira não afeta a segunda — regressão histórica: dados em falta após
  outage de token persistiram porque só a per-date foi limpa.
- [Certo] Token Freddy expira a cada ~60 dias. Sintoma: dados do Freddy a
  ZERO com dados do Intervals OK (7 dias 0km, intensidade vazia, YoY 0,
  previsão "dados de exemplo"). Fix: re-autorizar em /connect-freddy (device
  flow), aguardar TTL da cache. NÃO é bug de código.
- [Provável] PENDENTE DE RAIZ: erros de auth/rede não devem escrever cache
  (nem dados nem sentinel) — só "No data found" legítimo deve cachear. Sem
  isto, cada expiração de token envenena as duas caches.
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
  impossível). [Provável] atlLoad em falta num dia conta como 0 e subestima.
- [Certo] Atividades FANTASMA (GPS ligado por engano, <1km) são excluídas do
  card Último Treino e do histórico do coach: MIN_REAL_ACTIVITY_KM=1 em
  lib/utils/activity.ts (fonte única) + isGhostExecution em workout-history
  (também filtra pace >15:00/km).
- [Certo] CROSS-TRAINING (padel, ciclismo, etc.): activityType VEM
  preenchido do Freddy (ex: "PADDELBALL"). Entra APENAS no contexto do coach
  como carga/fadiga ("[ONTEM — ATIVIDADE CRUZADA ...]") e na verificação de
  segunda sessão. NUNCA entra em volume de corrida, 80/20, pace, decoupling,
  prescrito-vs-executado nem no card Último Treino. reviewMode é corrida-only.
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
- [Certo] Coach — NÃO se avalia a si próprio: se o evento ICU de hoje
  corresponde a coach:prescribed:{date} (comparação por NOME), o evento é
  ignorado e mantém-se prescribe. Log coach:icu-own. [Provável] Fragilidade:
  a comparação por nome dá falso positivo com nomes genéricos repetidos —
  melhoria futura: comparar por eventId guardado no push.
- [Certo] Coach — push faz UPDATE (PUT /events/{id}) quando já existe evento
  nosso para a data, em vez de duplicar. Confirmado em produção
  (coach:push action:"update"). Endpoint PUT validado.
- [Provável] O Llama falha o bloco ---ICU_WORKOUT--- ocasionalmente em modo
  prescribe (hasIcuBlock:false) → botão de push não aparece. É erraticidade
  do modelo, não bug de modo. PENDENTE: UI devia avisar ("treino sem bloco
  estruturado — pede de novo") em vez de esconder o botão silenciosamente.
- [Certo] LOGS PERMANENTES do coach (Runtime Logs Vercel, filtrar "coach:"):
  coach:mode (modo + reason: manual-field/icu-event/extracted-from-message/
  default-prescribe), coach:icu-block (hasIcuBlock), coach:activities
  (date/type/name/km), coach:icu-own, coach:push (action/eventId),
  coach:mode-mismatch, coach:history, coach:goal, coach:stress,
  coach:consistency. Retenção curta no Hobby — consultar logo após reproduzir.
- [Certo] Coach — filosofia 80/20: NUNCA comparar pace de treino
  fácil/volume com o pace de maratona (fáceis são propositadamente
  45-90s/km mais lentos). Comparação é contra o prescrito ou a faixa do
  TIPO de treino.
- [Certo] Coach — segunda sessão no mesmo dia: defeito é descanso; hora do
  treino de hoje entra no contexto; factos ausentes não se afirmam.
- [Certo] TSB/CTL/ATL de decisão vêm do último dia < hoje.
- [Certo] Decoupling só em execução CONTÍNUA (isPaceContinuous, CV<0.15) —
  em todos os ramos. Intervalado → null, badge ausente.
- [Certo] Interpretações no UI (ramp/monotonia/decoupling/sono): texto por
  LIMIARES EM CÓDIGO (constantes nomeadas), só visível em atenção/alerta;
  síntese quando ramp E monotonia ambos ≥atenção. NUNCA texto do LLM.
- [Certo] Previsão de maratona: Garmin se <14d, senão Riegel sobre records
  do Freddy (data = corrida real; janela 70d→180d com aviso; filtro de
  representatividade pace < goal×1.25×0.90; distância mais longa com
  penalização de antiguidade >45d).
- [Certo] checkIcuConsistency — extractTextTotalDistance: se há km ≥3 na
  PROSA usa o primeiro; senão SOMA os km dos cabeçalhos de secção (≥2);
  caso incerto → unverifiable, nunca warning. [Provável] Acopla-se ao
  formato de saída do coach — mexer no template de resposta exige revisitar
  esta função. Valida ainda: steps de distância com pace, não misturar
  HR/Pace, hasIntervals. Só valida DISTÂNCIAS (treinos 100% por tempo
  passam sem verificação real).
- [Certo] Fases do sono: estimadas por atigrafia — margem de erro
  significativa vs polissonografia, sobretudo REM. O rodapé de humildade no
  card é DELIBERADO (não remover); alertas valorizam tendências (3+ noites).
  Fases NÃO entram no composto (sleepScore já as pondera — dupla contagem).
- [Certo] RSC: Server Components NUNCA passam funções como props a Client
  Components — passar identificador string, resolver no client. O build NÃO
  apanha; só a página aberta (regressão histórica: sleepHmTick partiu
  /dashboard/sleep em produção).
- [Certo] Dev local com 404 em TODOS os _next/static/* ou "Failed to read
  source code" de ficheiros existentes = ambiente corrompido (cache .next
  mista ou processo node pendurado), NÃO bug de código. Protocolo:
  Get-Process node | Stop-Process -Force → Remove-Item -Recurse -Force
  .next → Test-Path do ficheiro acusado → npm run dev. Não reverter commits.
- [Certo] .env.local de teste precisa de STRAVA_LAB_API_KEY para zonas/
  splits do detalhe; AUTH_BYPASS=1 (só fora de produção) salta o login.

## Perfil do atleta (contexto de treino, 2026-07-24)
- [Certo] Zonas: FC máx 176, limiar FC 165, limiar de ritmo 3:54-3:56/km.
  O limiar de FC vem do relatório MEDIDO do Garmin (Connect → Reports →
  Running → Lactate Threshold: 165 bpm / 3:54 /km), não de estimativa.
  Histórico: valores anteriores 170/154 (comprimiam o volume aeróbico
  para "abaixo de Z1") e 176/158 (estimativa minha de 2026-07-23,
  corrigida pelo Garmin em 2026-07-24). Com limiar 165, o volume fácil
  do atleta (FC média ~131 em corridas de 1h30) fica legitimamente em
  Z1 — não é erro de calibração, é o padrão real de treino.
  Reavaliar quando bater FC >176 ou num teste de limiar de 30min.
- [Certo] Histórico: 1351 atividades (1260 corridas) 2016-2026 no Strava;
  FC consistente desde 2017 (100% desde 2021); mediana semanal 21km (2016)
  → 63km (2026); pico 115km/semana. Lacunas sazonais de ~22 semanas cada
  inverno (out-mar) — são informação (decaimento), não buracos.
- [Certo] 9 maratonas datadas: Porto 2018 5:56 · Europa 2019 6:03 · Porto
  2023 3:54 · Europa 2024 3:26 · Porto 2024 3:11 · Europa 2025 3:01 ·
  Porto 2025 3:13 · San Sebastián 2025 3:09 · Madrid 2026 3:35.
- [Certo] Madrid 2026 (3:35) é OUTLIER explicado: 700m altitude, perfil com
  desnível, calor. Não indica perda de forma — anotar as condições se
  entrar em qualquer modelo.
- [Certo] Europa 2025 (3:01) — splits: km 2-38 entre 4:04-4:19 (maioria
  4:11-4:16) com FC a DESCER na segunda metade (160→150). Colapso só nos
  km 39-42 (4:25/4:39/4:44/4:34) com FC a cair — assinatura de
  desidratação/stress térmico, não de fadiga muscular. Causa relatada:
  falta de abastecimentos + calor. CONCLUSÃO: o sub-3h não depende de mais
  motor; depende de hidratação/estratégia de prova.
- [Certo] Teste Kiprun 2026-07-19 (half-Cooper): 6min a 3:25/km, FC máx 166
  (~98% da máx). VO2max estimado ~60-63, coerente com o 61 do Garmin.
  Motor não é o fator limitante.

## Limitações de terceiros (documentadas — NÃO investir em workaround)
- [Certo] ICU→Garmin, multiple targets: misturar HR e Pace no mesmo workout
  → Garmin apaga todos os targets. Workouts de corrida são pace-only
  NUMÉRICO ("5:00-5:15/km Pace"); nunca "Zx Pace" (→ null-null se zonas ICU
  vazias), nunca sufixo HR. Fontes: forum.intervals.icu/t/130238, t/118130.
- [Certo] ICU→Garmin, repeat blocks (Nx): chegam ao relógio como NOTA de
  texto (bug do FIT generator do ICU — não injeta intensity nos steps de
  repeat). Aviso determinístico na UI quando hasIntervals. Fontes: t/124473,
  t/130465.
- [Certo] ICU→Garmin, MULTI-STEP: mesmo em treinos planos (sem Nx),
  pace-only, com threshold pace configurado (3:56/km), SÓ O PRIMEIRO STEP
  chega ao relógio com target — os restantes ficam como nota. Testado e
  reproduzido 2026-07-20/24. Hipótese t/130706 (threshold em falta)
  ELIMINADA. PENDENTE: abrir bug report no fórum do ICU com o caso concreto.
  Workaround possível não testado: download do FIT do ICU + cópia USB para
  /Garmin/NewFiles/ (verificar antes no fitfileviewer.com se o FIT tem
  target_type nos steps).
- [Certo] Kiprun Pace: sem API; ICU↔Garmin unidirecional (ICU→Garmin) —
  treinos Kiprun invisíveis programaticamente. Integração via campo manual
  "Plano de hoje".
- npm audit: 2 moderate = postcss embutido no Next 15, sem exposição real;
  só sai no Next 16. NUNCA npm audit fix --force (propõe Next 9).
- [Certo] @emnapi/* são devDeps DIRETAS de propósito (npm em Windows omite
  optional deps transitivas do lockfile; npm ci em Linux rebenta).

## Testes e CI
- Vitest — contagem: ver o último run do CI (números fixos aqui apodrecem;
  referência: ~410 em 2026-07-24). CI: npm ci + typecheck + lint + test.
- Fixtures REAIS em tests/fixtures/ — dados fisiológicos, .gitignore, NUNCA
  commitar. CI corre contra tests/fixtures-synthetic/. tools/capture-fixtures.ts
  recaptura (local). tools/analyze-history.ts caracteriza o export do Strava
  (CSV também .gitignore).

## Dívidas conhecidas
- Mover ReadinessCardData/RecoveryCardData para lib/types/ e apagar os
  componentes ReadinessCard/RecoveryCard (mortos; sobrevivem só pelos tipos).
- Composto de readiness: evoluir HRV para média 7d vs baseline 30-60d.
- Split de lib/freddy/metrics.ts (~2000 linhas) em módulos.
- Evaluate mode: veredicto ⚠️ "Ajusta" não empurra o treino ajustado ao
  relógio.
- Erro cru de STRAVA_LAB_API_KEY exposto ao cliente numa rota — humanizeError.
- Eixo do gráfico de Intensidade Semanal mostra "00.1%" no topo (deve ser
  100%) — formatação, 1 linha.
- coach:icu-own compara por NOME; melhorar para eventId.
- UI: quando hasIcuBlock=false em prescribe, avisar em vez de esconder o botão.
- checkIcuConsistency com divergência >20% devia pedir confirmação ANTES do
  push, não avisar depois.

## PENDENTE (itens desenhados, aguardam implementação ou confirmação)
- Fix de raiz "erros de auth/rede não cacheiam" (as duas caches) — desenhado,
  nunca confirmado em diff.
- Volume Semanal 18 semanas: gap 15/6-13/7 no gráfico apesar de os dados
  existirem no Freddy (confirmado por query direta). Log weekly_volume_byDate
  proposto; diagnóstico por fechar. [Provável] rawtext cache envenenada.
- lowVolume (<2h em zonas) a disparar em semanas de 30km+: reavaliar após o
  recálculo de zonas do ICU (limiar 7200s pode ser inadequado, ou comparar
  com tempo total de treino em vez de tempo em zonas ativas).
- Bug report ao fórum do ICU sobre o multi-step (ver Limitações).

## Roadmap
- Feitos: 1 (cache), 2 (limpeza), 3 (testes+CI), 4 (auth), 5+7 (memória do
  coach + decoupling + guardrails + formato 📊), 6 (80/20 semanal), 8
  (objetivo de prova + card Rumo ao sub-3h + Riegel representativo), 9
  (ramp/monotony com interpretações), evaluate/review modes, integração
  Kiprun (campo manual), hipnograma + alertas de sono, consistência ICU,
  card Último Treino, cross-training como contexto de fadiga, logs
  permanentes do coach, fixes de localização/AQI/HRV/TSB/pace/performance
  (dashboard 16s→3s).
- Item 10 (modelo melhor p/ prescrição): ADIADO — defeitos do Llama
  resolvidos por engenharia. Reavaliar só se o caderno de faltas justificar.
- GÉMEO DIGITAL (projeto PÓS-LISBOA, não antes): base empírica confirmada
  (Fase 0 feita — ver Perfil do atleta). Fase 1 = carga diária retroativa
  por época (TRIMP/hrTSS com as zonas DA ÉPOCA, não as de hoje) + modelo de
  Banister ajustado até 2024, validado contra as maratonas de 2025-2026,
  com erro reportado. Fase 2 = simulação de tapers ("que forma tenho a
  10/10 se cortar volume X% em Y semanas"). NÃO começar antes de Lisboa.
- Estado: bloco de construção FECHADO. Sessões futuras: fixes do caderno de
  faltas do utilizador — NÃO propor features novas por iniciativa própria.
- Foco até 10/10/2026 (11 semanas): cumprir plano Kiprun; ENSAIAR
  HIDRATAÇÃO em cada longo (é aí que estão os 60s que faltam ao sub-3h);
  10K de controlo para atualizar a previsão; horário de deitar fixo
  (experimento REM).