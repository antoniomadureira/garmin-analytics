# Garmin Analytics — Project Brief para nova sessão Claude

> Usa este documento como contexto completo para continuar o desenvolvimento desta aplicação. Contém stack, arquitectura, integrações, padrões confirmados, bugs conhecidos, e o estado actual de cada funcionalidade.

---

## 1. Identidade do Projecto

**Nome da app**: Garmin Analytics  
**URL produção**: `https://garmin-analytics.vercel.app`  
**Repositório**: `https://github.com/antoniomadureira/garmin-analytics`  
**Versão actual**: v57  
**Utilizador único**: António (corredor, usa Garmin + Strava + Intervals.icu)  
**Objectivo**: Dashboard pessoal de análise de corrida com IA, 100% gratuito, deployado no Vercel Hobby.

---

## 2. Stack Tecnológico

### Garmin Analytics (app principal)
| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Suspense) |
| Linguagem | TypeScript strict |
| Estilos | Tailwind CSS v3 |
| Gráficos | Recharts (AreaChart, RadarChart, etc.) |
| Mapas | Leaflet + react-leaflet |
| Estado cliente | Zustand, @tanstack/react-query |
| Ícones | lucide-react |
| Auth | JWT via `jose`, cookie httpOnly, OTP por email |
| Email OTP | Resend (free tier, sandbox) |
| Cache/KV | Upstash Redis REST (`@upstash/redis`) |
| IA | Groq API, modelo `llama-3.3-70b-versatile` (free tier) |
| Deploy | Vercel Hobby (`maxDuration = 60`, `force-dynamic` em todas as páginas de dados) |

### strava-lab (app proxy separada)
| Camada | Tecnologia |
|---|---|
| Framework | React + Vite (frontend) + Vercel Serverless Functions (`/api/*.js`) |
| Linguagem | JavaScript CommonJS |
| KV | Upstash Redis (mesma instância) |
| OAuth | Strava OAuth 2.0 com lock distribuído (SET NX, 20s TTL) |
| Deploy | `https://strava-lab.vercel.app` |
| Repositório | `https://github.com/antoniomadureira/strava-lab` |

---

## 3. Fontes de Dados e Integrações

### 3.1 Freddy MCP (Garmin + Intervals.icu)
- **Protocolo**: OAuth 2.0 Device Authorization Grant (RFC 8628) + Dynamic Client Registration (RFC 7591)
- **Gestão de tokens**: automática em `lib/freddy/oauth.ts`, guardada no Upstash
- **Activação**: visitar `/connect-freddy` uma vez após deploy
- **Métricas Garmin** usadas: `summarizedActivity_*`, `activity_*` (RunActivityMetrics), `trainingReadiness_score`, `racePredictions_*`, `sleepScore`, `sleepDuration`, `stepsTotal`, `heartRateRestingBpm`, `bodyBattery`
- **Métricas Intervals.icu** usadas: `wellness_ctl`, `wellness_atl`, `wellness_tsb`, `wellness_hrv`, `wellness_restingHR`, `wellness_sleepScore`, `wellness_stress`

#### ⚠️ Comportamentos críticos confirmados (não suposição)
| Problema | Confirmado | Solução implementada |
|---|---|---|
| Limite de 500 linhas por query | Sim — corta silenciosamente | `fetchInQuarterlyChunks()` em todos os pedidos `summarizedActivity_*` |
| `summarizedActivity_*` atraso ~30 dias | Sim | Usar `activity_*` para últimos 35 dias, merge por data |
| `trainingReadiness_score` atraso 5-6 dias | Sim | Composto próprio (TSB+HRV+FC+sono+stress) como fonte principal |
| `racePredictions_*` atraso igual | Sim | `days: 10` para alargar janela |
| `summarizedActivity_elevationGain` em centímetros | Sim | ÷100 para metros |
| `summarizedActivity_calories` em kJ | Sim | ÷4.184 para kcal |
| Pedidos em paralelo > 3 causam rate limit | Sim | Lotes de 3 com pausa de 200ms |

#### `fetchInQuarterlyChunks()` — função central
```typescript
// lib/freddy/metrics.ts
// Divide qualquer intervalo em trimestres, pede 3 em paralelo com pausa 200ms entre lotes.
// Usada em: getDailyTrend(), getRunningStatsOverview()
```

### 3.2 strava-lab (proxy Strava)
- **Autenticação**: `STRAVA_LAB_API_KEY` no header `x-api-key` — segredo partilhado entre as duas apps
- **Endpoints disponíveis**:
  - `GET /api/data?type=summary` → calçado + atividades recentes
  - `GET /api/data?type=activity&id=X` → segmentos + best efforts de 1 atividade
  - `GET /api/data?type=laps&id=X` → laps/splits
  - `GET /api/data?type=starred-segments` → segmentos favoritos
  - `GET /api/data?type=segment-history&id=X` → histórico pessoal num segmento
  - `GET /api/data?type=zones` → zonas de FC
  - `GET /api/data?type=records` → recordes pessoais (paginação completa, per_page=200)
  - `GET /api/gear-costs` → custos de equipamento (Upstash)
  - `POST /api/gear-costs { gearId, priceEur }` → gravar custo

#### Recordes pessoais — abordagem confirmada
- Pagina o histórico completo (até 1000 atividades, per_page=200 max confirmado)
- Tolerância de distância por marca (5km ±8%, 10km ±6%, Meia ±5%, Maratona ±5%)
- Usa só a listagem (sem chamadas extra por atividade) — velocidade vs exatidão perfeita

### 3.3 Intervals.icu
- **Auth**: Basic Auth com `API_KEY:{chave}` em base64
- **Endpoint de criação**: `POST /api/v1/athlete/{id}/events`
- **Env vars**: `INTERVALS_ICU_API_KEY`, `INTERVALS_ICU_ATHLETE_ID`
- **Sintaxe de treino** (campo `description`, parseado automaticamente pelo Intervals.icu):
  ```
  Warmup
  - 15m 65-70% HR
  
  6x
  - 800mtr 3:50-4:00/km Pace
  - 2m Z1
  
  Cooldown
  - 10m 60-65% HR
  ```
  ⚠️ `m` = minutos, `mtr` = metros, `km` = quilómetros
- **Push para Garmin**: Settings → Connections no Intervals.icu → "Upload planned workouts"
- **URL do calendário**: só `https://intervals.icu/calendar` (SPA, sem deep-links)

---

## 4. Variáveis de Ambiente

### Garmin Analytics (Vercel)
```
SESSION_SECRET=           # openssl rand -base64 32
ACCOUNT_OWNER_EMAIL=      # email do utilizador único
RESEND_API_KEY=           # Resend free tier
UPSTASH_REDIS_REST_URL=   # mesma instância para as 2 apps
UPSTASH_REDIS_REST_TOKEN=
GROQ_API_KEY=             # console.groq.com, free tier
STRAVA_LAB_API_URL=https://strava-lab.vercel.app
STRAVA_LAB_API_KEY=       # segredo partilhado com strava-lab
INTERVALS_ICU_API_KEY=
INTERVALS_ICU_ATHLETE_ID= # ex: i123456
```

### strava-lab (Vercel)
```
VITE_STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
UPSTASH_REDIS_REST_URL=   # mesma instância
UPSTASH_REDIS_REST_TOKEN=
DATA_API_KEY=             # = STRAVA_LAB_API_KEY acima
```

---

## 5. Estrutura de Ficheiros (Garmin Analytics)

```
app/
  dashboard/
    page.tsx              # Painel principal (force-dynamic, maxDuration=60)
    coach/page.tsx        # Consultor de Treino (Client Component)
    gear/page.tsx         # Equipamento (force-dynamic)
    heart-rate/page.tsx
    running/page.tsx      # Performance (Suspense por secção, maxDuration=60)
    sleep/page.tsx
    steps/page.tsx
  api/
    auth/
      logout/route.ts
      request-code/route.ts
      verify-code/route.ts
    coach/
      route.ts                    # Groq, buildContextSummary em 2 lotes
      push-to-intervals/route.ts  # POST → Intervals.icu
    freddy/activity-detail/route.ts
    strava-lab/
      activity-detail/route.ts
      gear-cost/route.ts
      zones/route.ts
  connect-freddy/page.tsx
  login/page.tsx

lib/
  freddy/
    metrics.ts            # FreddyMetricsService, fetchInQuarterlyChunks
    oauth.ts              # Device Flow + lock distribuído Upstash
    data-adapter.ts       # getFreddyDataService()
  strava-lab/
    client.ts             # getShoesAndActivities, getGearCosts, getPersonalRecords, etc.
  intervals/
    client.ts             # pushWorkoutToIntervals
  auth/session.ts         # JWT httpOnly cookie
  redis.ts
  utils/
    error-message.ts      # humanizeError() — normaliza "TypeError: fetch failed"

components/dashboard/
  nav.tsx                 # Navegação + logout com confirmação
  form-state.tsx          # RadarChart com tooltip
  training-load-card.tsx  # CTL/ATL/TSB (Intervals.icu)
  readiness-card.tsx      # Score composto transparente
  monthly-trend-chart.tsx # Filtro datas + comparação homóloga (mês de calendário)
  running-stats-charts.tsx # UnifiedAreaChart partilhado (4 gráficos, mesmo estilo)
  personal-records-panel.tsx # Separadores por distância, medalha, Strava Best Efforts
  gear-ring.tsx           # Anel conic-gradient, escala cores, custo/km editável
  gear-grid.tsx           # Grid de anéis, Client Component
  activity-detail-panel.tsx # Laps, best efforts, segmentos, tempo-em-zona
  markdown-lite.tsx       # Parser Markdown leve sem dependências
  running-skeleton.tsx    # Esqueleto de carregamento
```

---

## 6. Páginas e Funcionalidades

### Painel (`/dashboard`)
- Cards: Readiness composto (TSB+HRV+FC+sono+stress, 0-100), Estado de Treino (CTL/ATL/TSB), Sono, Passos, Body Battery
- Performance Radar (5 dimensões normalizadas, tooltip ao hover)
- Banner de forma baseado no score composto (mesma fonte do Consultor — consistência garantida)
- Lista de atividades recentes com painel de detalhe (clique → segmentos, laps, tempo-em-zona, FC samples)

### Performance (`/dashboard/running`)
- **Suspense por secção** (MonthlySection, StatsSection, RecordsSection — carregam independentemente)
- Gráfico de tendência diária (2 anos, chunking trimestral)
- Filtro de datas explícito (início/fim) + botões rápidos (7D/1M/3M/6M/YTD/1Y)
- Comparação homóloga: botão "Comparar com ano anterior" → duas linhas (actual vs anterior), eixo X por mês, acumulado cumulativo, % diferença
- Tiles: Esta Semana, Sem. Anterior, Média Semanal, Melhor Semana, Total YTD, Total Histórico (desde 2016)
- 4 gráficos de área com gradiente (mesmo estilo visual: UnifiedAreaChart)
- Recordes pessoais (Strava): separadores por distância (5km/10km/Meia/Maratona), medalha, pace
- **Fallback Strava**: quando Freddy falha, usa atividades Strava para gráfico + estatísticas

### Equipamento (`/dashboard/gear`)
- Anel conic-gradient por equipamento: percentagem dentro, km reais fora
- Escala de cores: verde (0-50%), amarelo (50-75%), laranja (75-90%), vermelho (90-100%), referência 700km
- Custo de compra editável (persiste no Upstash via strava-lab), calcula €/km automaticamente
- Botão "✎ editar" após primeiro preço

### Consultor de Treino (`/dashboard/coach`)
- Client Component, chat com histórico
- Contexto real (2 lotes com pausa 250ms para evitar rate limit):
  - **Lote 1**: `getTrainingReadiness(10)` + `getWellnessWeekly(8)` em paralelo
  - **Lote 2**: `getTrainingLoadSummary(7)` + `getWeeklyRunningSummary(7)` + `getComposedReadinessFromWellness(wellness)` + `getAthleteZones()` + `getRecentActivities(1)` (treino de hoje)
- **`getRecentActivities(1)`**: detecta treinos do próprio dia (usa `activity_*`, único source fresco para atividades de hoje — `summarizedActivity_*` tem atraso de ~30 dias)
- Sugestões rápidas: "Que treino posso fazer hoje?", etc.
- Resposta para treinos: formato Markdown estruturado + bloco `---ICU_WORKOUT---..---ICU_END---`
- Backend extrai o bloco ICU (invisível para o utilizador), disponibiliza `icuWorkout: {name, description}`
- Botão "Adicionar ao Intervals.icu → Garmin" aparece em respostas com treino estruturado
- Markdown renderizado via `MarkdownLite` (sem dependências externas)

---

## 7. Padrões Arquitecturais

### Rate limiting Freddy
- **Nunca** mais de 3 pedidos em paralelo
- `fetchInQuarterlyChunks` para qualquer query `summarizedActivity_*` que abranja > 1 trimestre
- `getComposedReadinessFromWellness(wellness)` recebe wellness já obtido (evita pedido duplicado confirmado como causa de rate limit)
- Cada lote separado por `await new Promise(r => setTimeout(r, 200))`

### Lock distribuído OAuth (strava-lab)
```javascript
const gotLock = await redis.set(REFRESH_LOCK_KEY, "1", { nx: true, ex: 20 });
// se não obteve lock, polling por 6 iterações × 700ms
// evita race condition com múltiplos invocações serverless a renovar simultaneamente
```

### Fallback em cascata (Performance)
1. Tentar Freddy → dados reais Garmin
2. Se Freddy falha → tentar Strava → dados reais mas limitados (30 atividades)
3. Se Strava também falha → dados de exemplo com aviso visual

### Mensagens de erro
```typescript
// lib/utils/error-message.ts
humanizeError(err) // "TypeError: fetch failed" → "Serviço temporariamente indisponível..."
```

### DataFreshnessDot
Componente visual (ponto verde/âmbar) que aparece no canto de cada secção: verde = dados reais, âmbar = dados de exemplo, tooltip com a mensagem de erro.

---

## 8. Decisões e Nomes Confirmados

| Contexto | Decisão |
|---|---|
| Nome da página "Corrida" | **Performance** |
| Nome da página "Calçado" | **Equipamento** |
| Nome da página "Treinador IA" | **Consultor de Treino** |
| Score composto | Média simples de 5 sinais (TSB, HRV, FC repouso, sono, stress) — transparente, não o algoritmo Garmin |
| Banner "Estado de Forma" | Usa score composto (mesma fonte do Consultor) — não TSB isolado |
| Gráficos | Todos `AreaChart` com gradiente — sem mistura de tipos |
| Comparação homóloga | Acumulado por mês de calendário (não por "dia N do período") — testado com dados sintéticos |
| Recordes | Via paginação completa Strava (per_page=200, até 1000 atividades), tolerância de distância |
| Total Histórico | Desde 2016 (não "3 anos") |

---

## 9. Limitações Conhecidas / Não Implementado

- **Garmin Connect API directa**: não existe API pública para escrever treinos. O único caminho é via Intervals.icu → Settings → Connections → "Upload planned workouts".
- **Deep-link Intervals.icu**: a app é uma SPA, não há URL para evento específico sem sessão. Usar sempre `https://intervals.icu/calendar`.
- **Sincronização Freddy não é instantânea**: `getRecentActivities(1)` pode não ver uma atividade feita há menos de 10-15 min.
- **`totalAllTimeKm` com Strava como fallback**: inclui só as 30 atividades mais recentes, não o histórico real.
- **Segmentos Strava**: implementados no strava-lab mas a página `/dashboard/segments` foi removida a pedido — pode ser reactivada.

---

## 10. Workflow de Deploy

1. Editar ficheiros localmente ou via GitHub web (editor web é mais fiável — PowerShell/Notepad local causou problemas)
2. `git add -A && git commit -m "..." && git push`
3. Vercel faz deploy automático ao push para `main`
4. Após adicionar env vars novas: **Redeploy obrigatório** (as vars só são lidas em deploys novos)
5. Validar com `Invoke-RestMethod` no PowerShell para endpoints de API

### Sincronizar local com GitHub (quando divergem)
```powershell
cd C:\Users\antonio.madureira\APPS\garmin-analytics
git fetch origin
git reset --hard origin/main
git clean -fd
```

---

## 11. strava-lab — Ficheiros API

```
api/
  _lib.js      # OAuth, lock distribuído, getShoes, listAllRunActivities, getPersonalRecords,
               # getActivityDetail, getActivityLaps, getStarredSegments,
               # getSegmentEffortHistory, getAthleteZones, getGearCosts, setGearCost
  auth.js      # POST /api/auth — troca código OAuth + guarda tokens no Upstash
  data.js      # GET /api/data?type=... — endpoint principal protegido por x-api-key
  gear-costs.js # GET/POST /api/gear-costs — persistência de preços de equipamento
```

---

## 12. Próximos Passos / Ideias em Aberto

- Validar se a sintaxe ICU gerada pelo modelo (campo `description`) é correctamente parseada pelo Intervals.icu como passos estruturados (ou chega só como texto)
- Potencial cache (Upstash, TTL curto) para as chamadas mais pesadas do Freddy, para reduzir tempo de carregamento em visitas repetidas
- Expandir fallback Strava a outras páginas além de Performance
- Adicionar mais distâncias-alvo nos recordes (1km, 3km, etc.)
