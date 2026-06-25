# Freddy Running Intelligence — Plataforma Pessoal

Stack 100% gratuita (validada 2026-06-25): Vercel Hobby + Upstash Redis Free + Resend Free.
Auth real do Freddy: OAuth 2.0 Device Authorization Grant + Dynamic Client Registration
(confirmado e testado em runtime — ver lib/freddy/oauth.ts).

## Passos de deploy
1. `npm install`
2. Upstash (Redis free) → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
3. Resend (free, sem domínio) → `RESEND_API_KEY` / `ACCOUNT_OWNER_EMAIL`
4. `SESSION_SECRET`: `openssl rand -base64 32`
5. `vercel deploy` → preencher env vars
6. Login → `/connect-freddy` → aprovar no browser (device flow)

## Estado dos mappers de dados (lib/freddy/metrics.ts) — 2026-06-25
- [Certo] `mapToRunActivityDetail` — implementado, shape confirmado (activityDetail_samples raw).
- [Certo] `mapToTrainingReadiness` — implementado, shape confirmado (trainingReadiness_score raw).
  Inclui dicionário de tradução de códigos (level, feedbackShort) PT — parcial, só os
  códigos vistos em runtime estão traduzidos; outros caem no fallback (código em minúsculas).
- [Certo] `mapToTrainingLoad` — implementado, shape confirmado (acuteTrainingLoad_* raw).
  `trainingStatus`/`fitnessLevelTrend` ficam vazios — vêm de métricas separadas
  (`trainingHistory_*`) ainda não testadas.
- [Certo] `mapToVo2Max` — implementado só para a fonte canónica (`userMetrics_vo2Max`).
  As outras 3 fontes (histórico, cross-check, biometria) não têm raw confirmado ainda —
  ficam `null`, não inventadas.
- [TODO] `mapToSleepSummary` — shape confirmado (registo completo de sono, overallSleepScore
  é objeto `{value, qualifierKey}`, não número), mas mapper ainda não escrito — é o mais
  complexo (sleepLevelsMap, respiração por timestamp) e não é usado por nenhum card ainda.
- [Certo] `mapToRacePrediction` — implementado, shape confirmado (4 tempos no mesmo registo).
- [Certo] `mapToRecovery` — implementado, shape confirmado. NOTA: dailyBodyBattery_chargedValue
  e stress_avgStressLevel são o MESMO registo diário, não chamadas independentes — só existe
  charged/drained, sem max/min reais; `bodyBatteryMax` usa charged como proxy.
  `recoveryTimeHours` fica `null` — vem de trainingReadiness_score (outro mapper), não deste.
- [Certo] `mapToSleepSummary` — implementado contra o registo completo de sono
  (overallSleepScore é objeto {value, qualifierKey}). Ainda não ligado a nenhum card.
- [Certo] `computeYearOverYearKpis` — implementado, mas por SOMA DE ESCALARES DE TEXTO,
  não por JSON. summarizedActivity_distance/duration/elevationGain/avgHr NÃO têm raw
  (confirmado). Cada atividade gera uma linha própria (1 dia pode ter 4+ atividades).
  Requer `FreddyMcpClient.queryRawText` (novo método opcional na interface).
- [Certo] Bug corrigido: `getTrainingLoadSummary` misturava acuteTrainingLoad_* (raw com
  acwrStatus) com trainingHistory_trainingStatus (raw SEM acwrStatus) — causava badge ACWR
  vazio no dashboard. Agora só pede acuteTrainingLoad_*; trainingStatus fica vazio até
  existir uma chamada dedicada a trainingHistory_*.
- [Certo] Bug corrigido: `include_raw` (snake_case) é o nome real do parâmetro da tool —
  o código enviava `includeRaw` (camelCase), confirmado errado contra o código fonte do
  @freddy-coach/cli oficial (github.com/tom-tms/freddy-mcp). A conversão faz-se em
  data-adapter.ts, na fronteira com a tool MCP.
- [Certo] Bug grave corrigido na comparação homóloga, confirmado por teste cruzado real:
  `summarizedActivity_elevationGain` está errado por um fator de EXATAMENTE 100x (confirmado
  comparando as mesmas 4 corridas de 21/06 nas tabelas activity_* vs summarizedActivity_*).
  `summarizedActivity_*` também tem um buraco de ~1 mês mais recente, coberto por `activity_*`.
  `computeYearOverYearKpis` agora combina as duas fontes (activity_* tem prioridade onde
  existe, summarizedActivity_* só preenche datas mais antigas, com elevação /100).
  Validado contra dados reais: distância exata (1590.2km), elevação a 0.4% (13588 vs 13534m),
  corridas a +3.7% (111 vs 107 — provavelmente segmentos GPS do mesmo dia contados em separado,
  não investigado a fundo).
- [TODO] `trainingHistory_trainingStatus` isolado, `mapToRunActivityDetail`'s vertical
  oscillation (confirmado ausente), ligação de Sleep e RacePrediction/Recovery a cards.

## Correção pendente nos componentes de UI (consequência dos dados reais)
- `RecoveryCard`: `recoveryTimeHours` no dashboard de exemplo assume horas; o dado real
  (`trainingReadiness_score.recoveryTime`) vem em SEGUNDOS — o mapper já converte
  corretamente, mas confirmar que nenhum outro sítio assume horas por engano.

## Histórico de correções de arquitetura desta sessão
1ª versão: OAuth 2.1 authorize/callback com client_id estático — suposição nunca confirmada.
2ª versão: API key pessoal — baseada numa "evidência" que era uma cópia de um output desta
própria conversa, não um teste real. 3ª versão (atual): device flow + DCR, testado e
confirmado pelo utilizador contra o servidor real do freddy.coach.
