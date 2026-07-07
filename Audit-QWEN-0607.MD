Qwen3.7-Plus

# Auditoria Técnica Multidisciplinar: Freddy Running Intelligence (garmin-analytics)

Esta auditoria foi realizada por uma equipa multidisciplinar simulada, analisando o repositório `https://github.com/antoniomadureira/garmin-analytics` (designado internamente como "Freddy Running Intelligence"). A análise baseia-se exclusivamente no código, estrutura, documentação e dependências visíveis no repositório até julho de 2026.

---

## PARTE I — Visão Geral

### Objetivo e Problema
O **Freddy Running Intelligence** é uma plataforma pessoal de inteligência de corrida que agrega dados de múltiplos ecossistemas (Garmin via Freddy.coach, Intervals.icu, Strava, Meteorologia, Qualidade do Ar) para fornecer uma visão unificada, contextualizada e acionável do estado de forma de um atleta. 
**Problema que resolve:** A fragmentação extrema dos dados de endurance. Um corredor tem dados no Garmin Connect (métricas fisiológicas, mas com atrasos de sincronização de dias), no Intervals.icu (carga de treino TSB/CTL/ATL precisa), no Strava (segmentos, sociais, zonas) e em apps de clima. O projeto unifica isto num único dashboard, resolvendo o "atraso crónico" do Garmin com fallback para o Intervals.icu, e adiciona uma camada de IA (Llama 3.3 70B via Groq) para prescrição de treinos contextualizada com o clima e qualidade do ar local.

### Público-Alvo e Casos de Utilização
- **Público-alvo:** Corredores de estrada, trail e ultratrail, de nível intermédio a avançado, que são "data-driven" e utilizam múltiplas plataformas. Treinadores que necessitam de uma visão consolidada (embora a arquitetura atual seja single-tenant).
- **Casos de utilização:**
  1. Verificar a prontidão para treinar hoje (Readiness composto vs Garmin Readiness atrasado).
  2. Receber prescrição de treino diária via IA com base no TSB, HRV, sono, clima e qualidade do ar.
  3. Analisar a evolução de volume, carga e recordes pessoais.
  4. Sincronizar automaticamente o plano de treino gerado pela IA para o calendário do Intervals.icu.

### Maturidade, Complexidade e Potencial
- **Maturidade:** Protótipo avançado / MVP funcional. O projeto está em desenvolvimento ativo (últimos commits em julho de 2026), com documentação técnica honesta sobre "gaps conhecidos" (ex: falta de Running Dynamics reais).
- **Complexidade:** Alta. Envolve OAuth 2.0 Device Flow, integração com protocolo MCP (Model Context Protocol), gestão de rate limits, fallbacks entre providers, e parsing de linguagem natural para estruturar treinos.
- **Potencial de evolução:** Muito alto. A arquitetura baseada em MCP e adapters permite adicionar novos providers (Coros, Suunto, Apple Health) sem reescrever a UI.

### Comparação com o Mercado
Diferencia-se do Strava (foco social) e do Garmin Connect (ecossistema fechado e com atrasos) pela **agregação multi-fonte inteligente** e pela **IA contextual** (clima + AQI + zonas reais do atleta). É concorrente direto do Intervals.icu e Runalyze, mas com uma camada de coaching generativo que estes não têm nativamente.

### Classificações (1-10)
| Dimensão | Nota | Justificação |
|---|---|---|
| **Qualidade** | 8 | Código TypeScript muito limpo, tipado, com excelente documentação inline sobre decisões de produto vs factos técnicos. |
| **Arquitetura** | 9 | Separação clara entre providers (Freddy, Intervals, Strava), adapters, e UI. Uso de MCP é visionário. |
| **Inovação** | 10 | Integração de MCP, IA generativa com output estruturado para Intervals.icu, e composição de métricas para colmatar atrasos de API. |
| **Escalabilidade** | 6 | Otimizado para single-tenant (plataforma pessoal). Multi-tenant exigiria refatoração da gestão de tokens OAuth e cache. |
| **UX** | 7 | Dashboard rico, mas a complexidade dos dados pode sobrecarregar utilizadores menos técnicos. |
| **Qualidade do Código** | 8 | Uso de Zod, singletons com fallback, tratamento defensivo de erros. Alguns ficheiros de métricas são muito longos. |
| **Potencial Comercial** | 7 | Como SaaS multi-tenant tem enorme potencial, mas exige reestruturação de auth e billing. |
| **Potencial Open-Source** | 9 | Excelente base para uma plataforma aberta de analytics de endurance, agnóstica ao provider. |

---

## PARTE II — Stack Tecnológica

### Frontend
- **Framework:** Next.js 15 (App Router). *Escolha:* Padrão de mercado em 2026 para React. *Vantagens:* SSR, RSC, otimizações automáticas. *Limitações:* Curva de aprendizagem do App Router.
- **Linguagem:** TypeScript 5.6. *Vantagens:* Tipagem estrita, essencial para dados complexos de métricas.
- **Bibliotecas:** React 19, TanStack Query v5 (cache e fetching), Zustand (estado global leve), Recharts (gráficos), Leaflet + react-leaflet (mapas).
- **UI/CSS:** Tailwind CSS 3.4, `clsx` + `tailwind-merge`, Lucide React (ícones). *Recomendado em 2026?* Sim, Tailwind é o padrão de facto.

### Backend
- **Runtime:** Node.js (via Vercel Serverless / Edge Runtime).
- **APIs:** Next.js Route Handlers (`app/api/`).
- **Integrações:** 
  - `@modelcontextprotocol/sdk` (MCP) para comunicação com o Freddy.coach.
  - REST API do Intervals.icu (Basic Auth).
  - Groq API (Llama 3.3 70B) para IA.
  - APIs de Weather e Air Quality.
- **Validação:** Zod v4.

### Persistência
- **Cache/Storage:** Upstash Redis (Free tier). Usado para cache de métricas e sessões.
- **Base de Dados:** Inexistente. O projeto é "stateless" em termos de persistência própria — depende inteiramente dos providers externos. *Limitação:* Dificulta histórico próprio, agregações complexas e multi-tenancy.

### Infraestrutura
- **Hosting/Deploy:** Vercel Hobby. *Vantagens:* Zero-config para Next.js. *Limitações:* Limites de execução serverless (timeout, memória) para processamento pesado.
- **CI/CD:** Implícito via Vercel GitHub integration.
- **Email:** Resend (free tier) para notificações.

### Autenticação
- **OAuth 2.0 Device Authorization Grant + Dynamic Client Registration (DCR)** via Freddy.coach. *Inovação:* Contorna a necessidade de um backend tradicional para OAuth callback, ideal para apps serverless/pessoais.
- **Sessões:** JWT (`jose`) em cookies (`freddy_session`), validado no middleware Edge.
- **Segurança:** Bypass de auth opt-in apenas em dev (`AUTH_BYPASS=1` e `NODE_ENV !== 'production'`).

---

## PARTE III — Arquitetura

### Organização e Padrões
O projeto segue uma **Feature-based Architecture** com camadas bem definidas:
1. **`app/` (App Router):** Rotas e UI. Sub-rotas como `dashboard/running`, `dashboard/coach`.
2. **`components/`:** Componentes de UI reutilizáveis (`ui/`) e específicos do dashboard (`dashboard/`).
3. **`lib/`:** Lógica de negócio e integrações.
   - `lib/freddy/`: Cliente MCP, mappers de métricas, cache, rate limiter.
   - `lib/intervals/`: Cliente REST para Intervals.icu.
   - `lib/strava-lab/`: Cliente para dados do Strava.
   - `lib/weather/`, `lib/utils/`, `lib/auth/`.

### Padrões Identificados
- **Adapter Pattern / Anti-Corruption Layer:** `lib/freddy/data-adapter.ts` e `metrics.ts` traduzem os dados brutos do MCP para interfaces de domínio estáveis (`SleepSummary`, `TrainingLoadEntry`).
- **Singleton Pattern:** `getFreddyClient()` em `lib/freddy/client.ts` mantém uma conexão MCP persistente durante a vida da instância serverless.
- **Repository Pattern (implícito):** `FreddyDataService` atua como repositório para métricas.
- **Middleware Pattern:** `middleware.ts` para auth e routing.
- **Fallback/Circuit Breaker:** O código está repleto de `.catch(() => null)` e fallbacks (ex: usar Intervals.icu quando o Garmin Readiness está atrasado).

### Diagrama Textual da Arquitetura
```text
[ UI (Next.js App Router / RSC) ]
       │
       ▼
[ API Routes (app/api/) ] ─────── [ Middleware (Auth/Edge) ]
       │
       ├─► [ Freddy MCP Client ] ──────► (Freddy.coach / Garmin)
       │       └─► [ Data Adapters / Mappers ]
       │
       ├─► [ Intervals.icu Client ] ───► (Intervals.icu REST API)
       │
       ├─► [ Strava-lab Client ] ──────► (Strava API)
       │
       ├─► [ Weather / AQI Clients ] ──► (OpenWeather / WAQI)
       │
       └─► [ Groq AI Client ] ─────────► (Llama 3.3 70B)
               │
               └─► [ Structured Output Parser ] ──► (Push to Intervals.icu)

[ Upstash Redis ] ◄── (Cache de métricas, sessões JWT)
```

---

## PARTE IV — Qualidade do Código

### Pontos Fortes
- **Documentação Inline Excecional:** O ficheiro `lib/freddy/metrics.ts` é uma obra de arte de documentação técnica. Explica *porque* certas decisões foram tomadas (ex: hierarquia de fontes do VO2 Max), lista "gaps conhecidos" confirmados em runtime, e previne que futuros desenvolvedores (ou a IA) inventem dados.
- **Defensive Programming:** Uso extensivo de `.catch(() => null)` e validações com Zod. O código assume que APIs externas vão falhar e desenha a UI para lidar com isso.
- **Type Safety:** Interfaces de domínio bem definidas (`SleepSummary`, `IcuPaceZones`).

### Problemas Identificados e Soluções

| Problema | Impacto | Solução Recomendada |
|---|---|---|
| **Ficheiros "God" (Mega-ficheiros)** | `lib/freddy/metrics.ts` contém consts, interfaces, mappers e a classe `FreddyDataService`. Dificulta manutenção. | **Alta.** Dividir em: `metrics/definitions.ts`, `metrics/interfaces.ts`, `metrics/mappers.ts`, `metrics/service.ts`. |
| **Hardcoding de Strings de Métricas** | Embora centralizado em `metrics.ts`, a adição de novas métricas exige editar um ficheiro gigante. | Criar um registo de métricas baseado em schema Zod que valide automaticamente contra o `list_metrics` do MCP. |
| **Duplicação de Lógica de Fallback** | A lógica de "se o dado X tem mais de N dias, usa Y" está espalhada por vários componentes e rotas. | Criar um hook ou utilitário `useFreshData<T>(primary, fallback, maxAgeDays)`. |
| **Gestão de Erros Silenciosa** | `.catch(() => null)` esconde falhas de rede ou de parsing. | Implementar um logger centralizado (ex: `lib/utils/logger.ts`) que registe erros no Upstash Redis ou Sentry, mesmo que a UI receba `null`. |
| **Acoplamento ao Upstash Redis** | `lib/redis.ts` está diretamente acoplado ao cliente Upstash. | Abstrair para uma interface `KeyValueStore`, permitindo trocar por Redis standard, DynamoDB, ou até memória em dev. |
| **Code Smell: "Suposição" no Código** | Comentários como `// [Suposição]` indicam código escrito sem teste de integração real. | Implementar testes de integração (Playwright ou Vitest) que validem os shapes das APIs externas em CI. |

---

## PARTE V — Frontend

### Estrutura e Componentização
- **Estrutura:** Segue o padrão do Next.js App Router. Pastas como `app/dashboard/running`, `app/dashboard/coach` indicam rotas aninhadas.
- **Componentes Reutilizáveis:** `components/ui/` (design system), `components/dashboard/` (widgets específicos como `readiness-card.tsx`, `training-load-card.tsx`, `recovery-card.tsx`, `route-map.tsx`).
- **Gráficos:** Uso de `recharts` (`activity-series-chart.tsx`, `monthly-trend-chart.tsx`, `trend-line-chart.tsx`).

### UX/UI e Acessibilidade
- **Design System:** Tailwind CSS com `lucide-react` para ícones coerentes (ex: `Footprints` para loading states).
- **Dark Mode:** Não foi explicitamente mencionado no `tailwind.config.ts` extraído, mas é crítico para apps de desporto (uso noturno/manhã cedo). *Recomendação:* Implementar `next-themes`.
- **Responsividade:** Componentes como `gear-grid.tsx` e `personal-records-tiles.tsx` sugerem layouts em grelha, mas a complexidade dos gráficos (`running-stats-charts.tsx`) pode ser difícil em mobile.
- **Acessibilidade (a11y):** Não há evidência de testes de a11y ou uso de `aria-*` nos componentes extraídos. *Crítico:* Gráficos de corrida devem ter tabelas alternativas ou descrições `aria-label` detalhadas.

### Classificação do Frontend: 7.5/10
**Pontos Fortes:** Componentização lógica, uso de RSC (React Server Components) para performance, design limpo com Tailwind.
**Fragilidades:** Falta de um design system documentado, ausência de dark mode (provável), gráficos complexos que podem sobrecarregar mobile, falta de testes de a11y.

---

## PARTE VI — Backend

### Arquitetura e Endpoints
- **API Routes:** `app/api/coach/route.ts` (IA), `app/api/auth/` (OAuth), `app/api/freddy/` (proxy/webhooks?), `app/api/strava-lab/`.
- **Serviços:** `FreddyDataService`, `IntervalsClient`, `StravaLabClient`.
- **Validação:** Zod para inputs da API.

### Segurança e Autorização
- **Auth:** Middleware Edge com JWT (`jose`). Validação de `SESSION_SECRET` com fail-loud (erro claro se faltar).
- **Rate Limiting:** `lib/freddy/limiter.ts` existe, indicando controlo de chamadas ao MCP.
- **CORS/CSRF:** Gerido automaticamente pelo Next.js/Vercel, mas cookies `freddy_session` devem ter `Secure`, `HttpOnly`, `SameSite=Lax`.

### Performance e Escalabilidade
- **Gargalo:** O endpoint `/api/coach` faz múltiplas chamadas em paralelo (`Promise.all`) a 8 serviços diferentes. Se um provider for lento, atrasa a resposta da IA.
- **Solução:** Implementar `Promise.any` ou timeouts individuais por provider, e cache agressivo no Redis para dados que mudam raramente (ex: `getIcuPaceZones` já tem `revalidate: 3600`).

### Melhoria Recomendada
Migrar a lógica de `buildContextSummary` (em `app/api/coach/route.ts`) para um **Background Job** (usando Upstash QStash ou Inngest). A IA não deve bloquear o request HTTP. O frontend faria polling ou usaria WebSockets/SSE para receber a resposta.

---

## PARTE VII — Dados

### Estrutura e Modelo
- **Modelo:** Não há base de dados relacional. O "modelo" é definido pelas interfaces TypeScript (`SleepSummary`, `TrainingLoadEntry`).
- **Normalização:** Os dados são normalizados pelos mappers (`mapToRunActivityDetail`, `mapToTrainingReadiness`) antes de chegar à UI.
- **Consistência:** O código lida brilhantemente com inconsistências entre providers (ex: Garmin Readiness atrasado vs Intervals.icu fresco).

### Oportunidades de Otimização
- **Agregação e Séries Temporais:** O projeto calcula agregações (ex: volume semanal) em runtime, a cada request. *Solução:* Implementar um "Data Warehouse" leve no Upstash Redis ou Upstash Kafka, pré-computando séries temporais diárias.
- **Compressão:** Dados de GPS (rotas) são pesados. `route-map.tsx` usa Leaflet. *Solução:* Algoritmo de Douglas-Peucker para simplificar polilinhas antes de enviar ao frontend.
- **Sincronização:** A dependência de webhooks do Garmin (com atrasos) é um ponto fraco. *Solução:* Implementar um "sync scheduler" que force polling direto à API Garmin Connect (se possível) ou use o Intervals.icu como fonte primária de verdade.

---

## PARTE VIII — Performance

### Gargalos Identificados
1. **Renderização de Gráficos:** `recharts` pode ser pesado em listas longas. *Solução:* Virtualização com `react-window` ou lazy loading de gráficos abaixo da fold.
2. **Bundle Size:** `leaflet` e `react-leaflet` são pesados. *Solução:* Dynamic import (`next/dynamic`) com `ssr: false` para o mapa.
3. **API Calls em Cascata:** O dashboard faz múltiplas chamadas a `/api/freddy/*`. *Solução:* Consolidar num único endpoint `/api/dashboard/summary` que retorna todos os dados necessários, ou usar GraphQL/tRPC.
4. **Memoization:** Uso de `useMemo` e `useCallback` não é visível nos extratos, mas é crítico para componentes com gráficos.

### Otimizações Propostas
- **Streaming (React 15):** Usar `<Suspense>` com fallbacks (skeletons) para cada card do dashboard, permitindo que o HTML chegue progressivamente.
- **Edge Caching:** Usar `stale-while-revalidate` no Next.js para dados que mudam a cada hora (ex: HRV, Readiness).

---

## PARTE IX — Segurança

### OWASP Top 10 e Gestão de Segredos
- **Tokens OAuth:** O fluxo Device Flow + DCR é seguro, mas o `access_token` do Freddy é armazenado onde? O código menciona `getValidAccessToken()`, que provavelmente usa o Redis ou cookies. *Risco:* Se armazenado em localStorage, é vulnerável a XSS. *Solução:* Armazenar exclusivamente em cookies `HttpOnly`.
- **Segredos (API Keys):** `GROQ_API_KEY`, `INTERVALS_ICU_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`. Estão em `env vars`, o que é correto. *Risco:* Logs. O código tem `console.warn(JSON.stringify({ evt: "mcp_client_error", err: String(e).slice(0, 150) }))`. *Solução:* Sanitizar logs para nunca imprimir tokens acidentalmente.
- **SQL Injection:** Não aplicável (NoSQL/Redis).
- **XSS/CSRF:** Next.js protege contra a maioria, mas o uso de `dangerouslySetInnerHTML` no `markdown-lite.tsx` (para o output da IA) é um **risco crítico**. *Solução:* Usar uma biblioteca de sanitização como `DOMPurify` ou `react-markdown` com plugins de sanitização.

### Dependências Vulneráveis
- `next@15`, `react@19`, `zod@4` são as versões mais recentes (2026).
- *Recomendação:* Implementar `npm audit` e `Snyk` no CI/CD.

---

## PARTE X — DevOps

### Deploy e CI/CD
- **Deploy:** Vercel Hobby. *Limitação:* Não adequado para produção multi-tenant (limites de bandwidth, execução).
- **CI/CD:** Ausente. Não há ficheiros `.github/workflows/` visíveis. *Solução:* Implementar GitHub Actions para:
  1. Linting e Typecheck (`npm run lint`, `npm run typecheck`).
  2. Testes unitários (Vitest).
  3. Testes E2E (Playwright) para fluxos críticos (login, dashboard).
  4. Security audit (`npm audit`).

### Observabilidade
- **Logs:** `console.warn` espalhados. *Solução:* Integrar com **Sentry** ou **Axiom** para error tracking e logs estruturados.
- **Monitorização:** Vercel Analytics oferece métricas básicas de Web Vitals. *Solução:* Adicionar métricas de negócio (ex: "tempo de resposta da IA", "taxa de falha do Garmin") via OpenTelemetry.

---

## PARTE XI — Inteligência Artificial

### Onde existe IA?
A IA está presente no **Consultor de Treino** (`app/api/coach/route.ts` e `app/dashboard/coach/`).
- **Modelo:** Llama 3.3 70B (via Groq API). *Escolha:* Rápido, gratuito/free-tier, compatível com OpenAI API.
- **Arquitetura:** RAG (Retrieval-Augmented Generation) implícito. O `buildContextSummary` recolhe dados em tempo real de 8 fontes e injeta-os no prompt do sistema.
- **Prompt Engineering:** O `SYSTEM_PROMPT_BASE` é extremamente detalhado, com regras de formatação (Markdown + bloco estruturado `---ICU_WORKOUT---` para o Intervals.icu).
- **Ferramentas/Agentes:** O modelo não chama ferramentas diretamente (Function Calling), mas o output é parseado no backend para extrair o treino e enviá-lo ao Intervals.icu via `pushWorkoutToIntervals`.

### Limitações e Custos
- **Custos:** Groq free tier é generoso, mas pode limitar em produção.
- **Alucinações:** O prompt tem regras estritas ("NUNCA inventar números"), mas a IA pode ainda assim inventar paces se as zonas não forem fornecidas.
- **Contexto:** O limite de tokens do Llama 3.3 70B é suficiente para o contexto atual, mas pode ser insuficiente para histórico longo de treinos.

### Funcionalidades Inovadoras com IA (Propostas)
1. **Análise Automática de Fadiga (Computer Vision + Dados):** Analisar a forma de corrida (se houver vídeo) ou padrões de FC/Pace para detetar fadiga assimétrica.
2. **Previsão de Lesão:** Usar um modelo de séries temporais (ex: Prophet ou LSTM) sobre HRV, Load e Sleep para prever risco de lesão.
3. **Agente de Planeamento de Prova:** Um agente que, dado um objetivo (ex: "Maratona em 12 semanas"), cria um plano completo, ajusta-o semanalmente com base na adesão, e comunica com o atleta via WhatsApp/Email.
4. **Modelos Locais (Ollama):** Permitir que o utilizador corra o modelo localmente para privacidade total dos dados de saúde.
5. **MCP Multi-Provider:** Expandir o MCP para incluir ferramentas de análise de solo (trail), previsão meteorológica hiperlocal, e nutrição.

---

## PARTE XII — UX

### Fluxos e Facilidade de Utilização
- **Onboarding:** O fluxo de login via Device Flow (`/connect-freddy`) é inovador mas pode ser confuso para utilizadores não técnicos (exige "aprovar no browser"). *Solução:* Adicionar um vídeo tutorial ou guia passo-a-passo visual.
- **Descoberta:** O dashboard é denso. *Solução:* Implementar um "Tour" interativo (ex: `react-joyride`) para explicar cada card.
- **Feedback:** O loading state com ícone `Footprints` é um toque de design excelente.
- **Microinterações:** A sincronização de treinos com o Intervals.icu deve ter um feedback visual claro (toast de sucesso com link para o calendário).

### Melhorias Concretas
1. **Modo "Foco":** Um botão que esconde todos os cards exceto o "Prontidão Hoje" e "Treino Sugerido".
2. **Notificações Push:** Integrar com Vercel KV ou OneSignal para alertar o atleta quando o treino estiver pronto ou quando o Garmin sincronizar.
3. **Exportação:** Permitir exportar o dashboard para PDF (relatório semanal para o treinador humano).

---

## PARTE XIII — Benchmark

| Plataforma | O que faz melhor | O que faz pior | Funcionalidades em falta no Freddy |
|---|---|---|---|
| **Garmin Connect** | Ecossistema fechado, métricas proprietárias (Body Battery, Training Readiness). | Atrasos de sincronização, UI datada, sem IA generativa. | Análise de terreno (trail), IA contextual. |
| **Strava** | Social, segmentos, UX mobile. | Métricas de treino superficiais, sem carga de treino científica. | TSB/CTL/ATL, prescrição de treino. |
| **Intervals.icu** | Cálculo preciso de TSB/CTL/ATL, flexibilidade. | UI complexa, sem IA, sem dados fisiológicos diretos. | Coaching generativo, integração climática. |
| **TrainingPeaks** | Planeamento de planos de treino, TSS. | Caro, UI antiga, sem IA. | Agregação multi-provider, IA. |
| **Runalyze** | Análise estatística profunda, open-source. | UI complexa, requer self-hosting. | IA, design moderno, mobile. |
| **Final Surge** | Coaching humano + software. | Caro, focado em treinadores. | Versão self-service para atletas. |
| **Stryd** | Potência de corrida, Critical Power. | Requer hardware extra. | Integração nativa de potência sem Stryd (via estimativa). |
| **Golden Cheetah** | Análise científica profunda, open-source. | Desktop apenas, curva de aprendizagem extrema. | Cloud, mobile, IA. |

**Diferencial do Freddy:** É o único que combina **IA generativa contextual** (clima + AQI + zonas reais) com **agregação multi-provider** e **output estruturado** (push para Intervals.icu).

---

## PARTE XIV — Análise como Especialista em Corrida

*Assumindo o papel de Treinador Internacional de Atletismo (Estrada, Trail, Ultratrail)*

### Utilidade dos Indicadores Atuais
- **Para Iniciantes:** O "Training Readiness" e o "Treino Sugerido pela IA" são excelentes. Dão confiança e direção.
- **Para Intermédios:** O "Training Load" (ACWR) e o "Volume Semanal" são cruciais para evitar o erro clássico de "fazer demais, demasiado cedo".
- **Para Avançados/Maratonistas:** O "Race Prediction" e as "Pace Zones" do Intervals.icu são vitais para calibrar o ritmo de prova.
- **Para Trail/Ultratrail:** **FALTA CRÍTICA.** O projeto não analisa elevação por hora, terreno técnico, ou métricas de potência em trail. O "Air Quality" e "Weather" são úteis, mas falta "Wind Exposure" (exposição ao vento) para trail de altitude.

### Indicadores Redundantes
- **VO2 Max (4 fontes):** O Garmin VO2 Max é notoriamente impreciso para trail e calor. Ter 4 fontes cria confusão. *Solução:* Unificar num único "Estimated Fitness Index" que pondera as fontes por confiabilidade no contexto atual.
- **Body Battery vs Stress:** São métricas correlacionadas. Apresentar ambas no mesmo card é redundante.

### Indicadores em Falta (Críticos para Ciência do Exercício)
1. **Dissociação Cardíaca (Cardiac Drift):** Essencial para monitorizar fadiga e desidratação em treinos longos.
2. **Eficiência de Corrida (Running Economy):** Pace normalizado por FC. Se o atleta corre ao mesmo pace mas com FC mais baixa, melhorou.
3. **Variabilidade de Pace/Power:** Em trail, a variabilidade é esperada. Em estrada, indica má gestão de esforço.
4. **Trimp (Banister/Edwards):** O ACWR é bom, mas o TRIMP baseado em zonas de FC é mais validado cientificamente para fadiga.
5. **Heat Adaptation:** O projeto tem "Weather", mas não calcula um índice de adaptação ao calor (ex: declínio do pace em função da temperatura ao longo de semanas).

---

## PARTE XV — Métricas Recomendadas

Lista priorizada de métricas que devem ser implementadas, com foco em Ciência do Exercício.

### 1. Training Load & Periodização
| Métrica | Explicação | Benefícios | Como Calcular | Visualização | Prioridade |
|---|---|---|---|---|---|
| **TRIMP (Banister)** | Carga de treino baseada em tempo x intensidade (FC). | Padrão ouro para fadiga. | `Sum(Duration * HR_zone_factor)` | Gráfico de barras diárias. | Alta |
| **Acute/Chronic Load (CTL/ATL)** | Média exponencial de TRIMP (7 dias vs 42 dias). | Prever forma e fadiga. | `EMA(TRIMP, decay_factor)` | Gráfico de linhas duplas (Performance Management Chart). | Alta |
| **TSB (Form)** | `ATL - CTL`. | Saber quando "afiar" para uma prova. | Fórmula Banister. | Área preenchida entre ATL e CTL. | Alta |
| **ACWR (Monotony/Strain)** | `Acute / Chronic`. | Prevenir lesões (sweet spot 0.8-1.3). | `AcuteLoad / ChronicLoad` | Gauge com zonas de risco. | Alta |
| **Training Readiness Composto** | Já existe, mas deve ponderar HRV, TSB, Sono, e **Dissociação Cardíaca**. | Visão holística. | Média ponderada de sinais normalizados. | Score 0-100 com "semáforo". | Alta |

### 2. Fisiologia e Eficiência
| Métrica | Explicação | Benefícios | Como Calcular | Visualização | Prioridade |
|---|---|---|---|---|---|
| **Efficiency Factor (EF)** | `Pace / HR` (ou Velocidade / FC). | Medir economia de corrida. | `AvgPace / AvgHR` por treino. | Gráfico de dispersão (Pace vs HR) com linha de tendência. | Alta |
| **Cardiac Drift** | Aumento da FC sem aumento de pace no final do treino. | Detetar fadiga/desidratação. | `HR_final_20min - HR_first_20min` (mesmo pace). | Gráfico de linhas (FC vs Tempo) com anotação de drift. | Média |
| **Vertical Oscillation Ratio** | Oscilação vertical / velocidade. | Eficiência mecânica. | `VertOsc / Speed`. | Gráfico de evolução mensal. | Média |
| **Leg Spring Stiffness (LSS)** | Rigidez do sistema muscultendinoso. | Performance e risco de lesão. | Fórmula baseada em massa, velocidade, tempo de contacto. | Gauge comparativo com média pessoal. | Baixa |
| **Heat Adaptation Index** | Declínio do pace em função da temperatura. | Saber se está adaptado ao calor. | Regressão linear de `Pace vs Temp` ao longo de 14 dias. | Gráfico de dispersão com linha de tendência. | Alta (Verão) |

### 3. Previsão e Performance
| Métrica | Explicação | Benefícios | Como Calcular | Visualização | Prioridade |
|---|---|---|---|---|---|
| **Critical Speed / VDOT** | Velocidade teórica para provas de diferentes distâncias. | Prever tempos de prova. | Regressão não-linear de `Distance vs Time` (Jack Daniels). | Tabela de previsões (5k, 10k, HM, FM). | Alta |
| **W' (Anaerobic Work Capacity)** | Energia finita acima do Critical Power. | Gestionar esforços em trail/séries. | Modelo W' balance. | Gráfico de "bateria" anaeróbia. | Média |
| **Race Readiness Score** | Combinação de TSB, Volume de pico, e especificidade. | Saber se está pronto para a prova. | Algoritmo próprio baseado em literatura. | Score 0-100%. | Alta |
| **Injury Risk Score** | Combinação de ACWR fora da zona, Monotony, Sleep, HRV. | Prevenção. | Modelo de machine learning (floresta aleatória) sobre dados históricos. | Semáforo (Verde/Amarelo/Vermelho). | Alta |

---

## PARTE XVI — Funcionalidades Futuras (Roadmap de Produto)

### Próximos 3 Meses (Quick Wins)
1. **Dark Mode e Acessibilidade:** Implementar `next-themes` e auditoria a11y. (Impacto: Alto, Esforço: Baixo).
2. **Exportação de Relatório PDF:** Gerar um relatório semanal para partilhar com treinador humano. (Impacto: Alto, Esforço: Médio).
3. **Detecção de "Ghost Activities":** Identificar atividades que não sincronizaram corretamente. (Impacto: Médio, Esforço: Baixo).

### Próximos 6 Meses (Core Features)
1. **Critical Speed e W':** Implementar modelo de previsão de performance baseado em potência/pace. (Impacto: Alto, Esforço: Alto).
2. **Heat Adaptation Tracker:** Algoritmo que calcula a adaptação ao calor com base no histórico. (Impacto: Alto, Esforço: Médio).
3. **Integração com Wearables Adicionais:** Suporte para Coros e Apple Health via HealthKit. (Impacto: Alto, Esforço: Alto).

### Próximos 12 Meses (Inovação)
1. **Agente de Planeamento Autónomo:** A IA cria um plano de 12 semanas, ajusta-o semanalmente, e comunica via WhatsApp. (Impacto: Muito Alto, Esforço: Muito Alto).
2. **Análise de Trail com IA:** Usar dados de elevação e tipo de terreno para sugerir treinos específicos para trail. (Impacto: Alto, Esforço: Alto).
3. **Multi-Tenancy (SaaS):** Permitir que treinadores criem contas para os seus atletas. (Impacto: Muito Alto, Esforço: Muito Alto).

### Próximos 24 Meses (Visão)
1. **Computer Vision para Técnica:** Análise de vídeo do atleta para corrigir postura. (Impacto: Alto, Esforço: Muito Alto).
2. **Integração com Nutrição:** Sincronizar com apps de dieta para correlacionar alimentação com performance/recuperação. (Impacto: Médio, Esforço: Alto).

---

## PARTE XVII — Roadmap Técnico

| Prioridade | Funcionalidade | Impacto | Complexidade | Tempo Estimado | Dependências | Risco |
|---|---|---|---|---|---|---|
| **P0** | Refatorar `lib/freddy/metrics.ts` em módulos | Alto | Média | 1 semana | Nenhuma | Baixo |
| **P0** | Implementar CI/CD (GitHub Actions + Vitest) | Alto | Baixa | 3 dias | Nenhuma | Baixo |
| **P0** | Sanitizar output de Markdown (XSS) | Crítico | Baixa | 1 dia | Nenhuma | Alto (se ignorado) |
| **P1** | Migrar logs para Sentry/Axiom | Médio | Baixa | 2 dias | P0 | Baixo |
| **P1** | Implementar Dark Mode | Alto | Baixa | 2 dias | Nenhuma | Baixo |
| **P1** | Adicionar métricas de TRIMP e TSB | Alto | Alta | 2 semanas | P0 | Médio |
| **P2** | Background Jobs para IA (Upstash QStash) | Alto | Alta | 1 semana | P1 | Médio |
| **P2** | Suporte a Coros/Apple Health | Alto | Muito Alta | 4 semanas | P1 | Alto |
| **P3** | Multi-Tenancy (Auth0/Supabase) | Muito Alto | Muito Alta | 8 semanas | P2 | Muito Alto |
| **P3** | Agente de Planeamento Autónomo | Muito Alto | Muito Alta | 12 semanas | P2 | Alto |

---

## PARTE XVIII — Conclusão

### Análise SWOT
- **Pontos Fortes:** Arquitetura moderna (MCP, Next.js 15), integração de IA contextual, documentação técnica excecional, código limpo e defensivo.
- **Fragilidades:** Single-tenant, falta de base de dados própria, dependência crítica de providers externos (Garmin/Intervals), falta de testes automatizados.
- **Oportunidades:** Mercado de SaaS para treinadores, expansão para outros desportes (ciclismo, triatlo), open-source community.
- **Ameaças:** Mudanças nas APIs do Garmin/Intervals, custos de IA em escala, concorrência de gigantes (Strava/Garmin) que integrem IA.

### Potencial
- **Comercial:** 8/10 (Como SaaS para treinadores).
- **Open-Source:** 9/10 (Excelente base para uma plataforma aberta).
- **Académico/Científico:** 7/10 (Útil para estudos de fisiologia, mas requer validação das métricas).
- **Alta Competição:** 6/10 (Faltam métricas de elite como LSS, W', e análise de terreno).

### Classificação Global: 82/100
- **Arquitetura e Código:** 90/100
- **Inovação e IA:** 95/100
- **UX e Design:** 75/100
- **Ciência do Exercício:** 70/100
- **DevOps e Segurança:** 75/100

**Veredito:** O **Freddy Running Intelligence** é um projeto visionário que resolve um problema real (fragmentação de dados + atrasos de sincronização) com uma arquitetura moderna e inovadora (MCP + IA generativa). Para evoluir de "plataforma pessoal" para "produto comercial", necessita de investir em multi-tenancy, testes automatizados, e aprofundar a ciência do exercício com métricas de elite. É, sem dúvida, um dos projetos mais interessantes no espaço de analytics de corrida em 2026.

---

## TOP 50 MELHORIAS PRIORITÁRIAS

Lista ordenada por impacto, esforço, valor para o utilizador e prioridade estratégica.

1. **Sanitizar output de Markdown (XSS)** (Segurança, P0)
2. **Refatorar `lib/freddy/metrics.ts`** (Manutenibilidade, P0)
3. **Implementar CI/CD com GitHub Actions** (DevOps, P0)
4. **Adicionar testes unitários (Vitest)** (Qualidade, P0)
5. **Implementar Dark Mode** (UX, P1)
6. **Migrar logs para Sentry** (Observabilidade, P1)
7. **Calcular TRIMP (Banister)** (Ciência, P1)
8. **Implementar Performance Management Chart (TSB/CTL/ATL)** (Ciência, P1)
9. **Adicionar Efficiency Factor (Economy)** (Ciência, P1)
10. **Detecção de Heat Adaptation** (Ciência, P1)
11. **Background Jobs para IA (QStash)** (Performance, P2)
12. **Multi-tenancy (Auth0/Supabase)** (Comercial, P2)
13. **Suporte a Coros/Apple Health** (Integração, P2)
14. **Critical Speed e W'** (Ciência, P2)
15. **Exportação de Relatório PDF** (UX, P2)
16. **Notificações Push (Vercel KV/OneSignal)** (UX, P2)
17. **Virtualização de Gráficos (react-window)** (Performance, P2)
18. **Dynamic Import para Leaflet** (Performance, P2)
19. **Abstrair Upstash Redis (KeyValueStore interface)** (Arquitetura, P2)
20. **Implementar Tour Interativo (react-joyride)** (UX, P2)
21. **Análise de Variabilidade de Pace/Power** (Ciência, P3)
22. **Cardiac Drift Analysis** (Ciência, P3)
23. **Injury Risk Score (ML)** (Inovação, P3)
24. **Integração com Nutrição** (Ecossistema, P3)
25. **Agente de Planeamento Autónomo** (Inovação, P3)
26. **Análise de Trail com IA** (Inovação, P3)
27. **Computer Vision para Técnica** (Inovação, P4)
28. **Suporte a Ciclismo/Triatlo** (Expansão, P4)
29. **API Pública para Developers** (Ecossistema, P4)
30. **Mobile App (React Native/Expo)** (UX, P4)
31. **Integração com Smartwatches (Write-back)** (UX, P4)
32. **Análise de Terreno (Trail)** (Ciência, P4)
33. **Previsão de Lesão com LLM** (Inovação, P4)
34. **Voice Coach (TTS)** (UX, P4)
35. **Social Features (Clubes)** (Engajamento, P4)
36. **Marketplace de Planos de Treino** (Comercial, P4)
37. **Integração com Gyms/Indoor** (Ecossistema, P4)
38. **Análise de Sono Avançada (Oura/Whoop)** (Integração, P4)
39. **Gamification (Achievements)** (Engajamento, P4)
40. **White-label para Treinadores** (Comercial, P4)
41. **Integração com Nutrition (MyFitnessPal)** (Ecossistema, P4)
42. **Análise de Altitude (Hipóxia)** (Ciência, P4)
43. **Suporte a Natação** (Expansão, P4)
44. **Análise de Vento (Aerodinâmica)** (Ciência, P4)
45. **Integração com Equipamento (Wearables)** (Ecossistema, P4)
46. **Previsão de Performance com ML** (Inovação, P4)
47. **Análise de Corrida em Esteira** (Ciência, P4)
48. **Integração com Fisioterapia** (Ecossistema, P4)
49. **Análise de Poluição Sonora** (Ambiente, P4)
50. **Comunidade Open-Source (Discord/GitHub)** (Ecossistema, P4)