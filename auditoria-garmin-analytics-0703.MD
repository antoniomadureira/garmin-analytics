# Auditoria Técnica — garmin-analytics (Freddy Running Intelligence)

**Data:** 2026-07-03 · **Base:** clone real do repositório `antoniomadureira/garmin-analytics` (8.703 linhas TS/TSX, 90 ficheiros)
**Convenção de confiança:** [Certo] = verificado no código · [Provável] = inferência forte · [Suposição] = não verificável a partir do repo

---

## PARTE I — Visão Geral

**Objetivo** [Certo]: dashboard pessoal de análise de corrida, single-user, 100% free tier (Vercel Hobby + Upstash + Resend + Groq), agregando Garmin (via Freddy MCP), Intervals.icu e Strava (via app-proxy `strava-lab`), com treinador IA que gera treinos e os empurra para o Intervals.icu.

**Problema que resolve** [Certo]: o Garmin Connect não expõe API pessoal utilizável; o Freddy MCP resolve o acesso, mas com atrasos de webhook (Training Readiness até 5-6 dias). A app compõe um readiness próprio a partir de sinais frescos do Intervals.icu — este é o insight de produto mais valioso do projeto.

**Público-alvo** [Certo]: exatamente 1 pessoa. `ACCOUNT_OWNER_EMAIL` hardcoded na lógica de auth, `userId` derivado por hash do email, tokens Freddy guardados numa chave Redis global sem namespace de utilizador. Não é uma limitação acidental — está documentada — mas invalida qualquer classificação de "potencial comercial" no estado atual.

**Maturidade** [Certo]: protótipo avançado em produção pessoal. Sem testes (zero ficheiros de teste), sem CI/CD (sem `.github/`), sem LICENSE, com artefactos de desenvolvimento na raiz (`freddy-test.ps1`, `freddy-data-architecture.ts`, `freddy_metrics.md`) e uma árvore `api/` inteira duplicada e desatualizada ao lado de `app/api/` ([Certo] `diff` confirma que os ficheiros divergem — código morto).

**Complexidade**: média-alta na camada de dados (parsing de texto de MCP, merge de fontes com bugs de unidades confirmados), baixa no resto.

**Comparação com mercado**: não compete com Intervals.icu/Runalyze em features — compete em *frescura composta multi-fonte + coach IA acionável*. Nenhuma das plataformas estabelecidas gera um treino do dia com meteo local e o cria diretamente no calendário do Intervals.icu num clique. Esse fluxo é genuinamente diferenciador.

**Classificações (1-10)**

| Dimensão | Nota | Justificação |
|---|---|---|
| Qualidade | 6.5 | Código honesto, documentado com rigor epistémico raro (tags [Certo]/[Provável] no próprio código), mas sem testes e com código morto |
| Arquitetura | 6 | Boa separação metrics/adapter/client, mas assente num parser de texto frágil e num god-file de 1.972 linhas |
| Inovação | 8 | Composto de readiness transparente + pipeline coach→ICU push é original |
| Escalabilidade | 3 | Single-user por design em auth, tokens e Redis keys |
| UX | 7 | [Provável] Cards com fallback para mock + aviso visível, skeletons, freshness dots — padrão maduro |
| Qualidade do código | 6 | TS strict, naming bom, mas duplicação `api/`↔`app/api/` e extração de dados por scraping de texto |
| Potencial comercial | 3 | Exigiria multi-tenancy total e dependência de um serviço terceiro (Freddy) fora do teu controlo |
| Potencial open-source | 7 | Como *template* "self-hosted running dashboard free-tier" tem procura real; falta LICENSE, testes, docs de setup genéricas |

---

## PARTE II — Stack Tecnológica

[Certo] Extraído de `package.json` e código:

**Frontend**: Next.js 15 (App Router, Server Components, Suspense por `loading.tsx`), React 19, TypeScript strict, Tailwind CSS 3, Recharts 2, Leaflet + react-leaflet 5, lucide-react, clsx + tailwind-merge. **Estado**: Zustand 5 e TanStack Query 5 declarados — [Provável] subutilizados ou não utilizados: a app é maioritariamente Server Components com fetch no servidor; não encontrei stores Zustand nem QueryClient nos ficheiros lidos. Candidatos a remoção do bundle.

**Backend**: Next.js Route Handlers (Node runtime), `@modelcontextprotocol/sdk` 1.29 (StreamableHTTP client), `jose` (JWT HS256), `resend` (email OTP), `zod` 4 declarado — [Provável] pouco/nada usado na validação de rotas (as rotas validam à mão com `typeof body?.email === "string"`). Contradição: tens a ferramenta certa instalada e não a usas onde mais importa.

**Persistência**: Upstash Redis REST como único store (tokens OAuth, OTP, cache implícita). Sem base de dados relacional — o `userId` placeholder em `verify-code/route.ts` admite isso explicitamente.

**Infraestrutura**: Vercel Hobby, `maxDuration=60`, `force-dynamic`. Sem Docker, sem CI, `vercel.json` mínimo. Deploy = `git push` implícito.

**Autenticação**: OTP por email (Resend sandbox) + sessão JWT httpOnly 30 dias. Freddy: OAuth 2.0 Device Flow (RFC 8628) + DCR (RFC 7591). Intervals.icu: Basic Auth com API key. strava-lab: shared secret `x-api-key`.

**IA**: Groq `llama-3.3-70b-versatile` (free tier).

**Avaliação 2026**: a stack continua recomendada. Duas ressalvas: (1) Tailwind 3 — a v4 é o standard atual, migração barata; (2) Recharts é adequado mas pesado para o que fazes; se algum dia importar bundle, `visx` ou SVG manual. Groq/Llama 3.3 é a escolha certa para custo zero; a qualidade de prescrição de treino do 70B é o teto real do "coach" (ver Parte XI).

---

## PARTE III — Arquitetura

**Padrões identificados** [Certo]: Service Pattern (`FreddyDataService`), Adapter (`data-adapter.ts` na fronteira MCP), Anti-Corruption Layer informal (const objects de metric names como "fonte de verdade"), Facade sobre strava-lab. Não há MVC, DDD formal, CQRS nem event-driven — nem precisavas.

**Diagrama textual**

```
Browser
  └─ app/dashboard/* (Server Components, force-dynamic)
       ├─ lib/freddy/data-adapter.ts ── parser de texto → { [date]: raw }
       │     └─ lib/freddy/client.ts ── MCP StreamableHTTP + Bearer
       │           └─ lib/freddy/oauth.ts ── DCR + Device Flow + refresh (Upstash)
       ├─ lib/freddy/metrics.ts (1.972 l.) ── consts + mappers + FreddyDataService
       ├─ lib/strava-lab/client.ts ── HTTPS x-api-key → strava-lab.vercel.app
       ├─ lib/weather/client.ts
       └─ app/api/coach ── contexto composto → Groq → Markdown + bloco ICU
             └─ app/api/coach/push-to-intervals → intervals.icu API
Auth: middleware.ts (Edge, JWT) + app/api/auth/* (OTP Resend + Upstash)
```

**Problemas estruturais**

1. [Certo] **Fundação em scraping de texto.** `parseQueryMetricsText` e `extractValuesByDate` fazem parse da renderização *humana* do MCP ("YYYY-MM-DD:\n metric: valor\n raw: {...}"). O próprio código admite ([Provável] no comentário) que o formato do content block em produção nunca foi confirmado contra o envelope literal. Qualquer mudança cosmética no output do Freddy parte a app inteira silenciosamente. É o risco nº 1 do projeto.
2. [Certo] **`metrics.ts` é um god-file**: consts, interfaces, service, mappers, parsers escalares e lógica de readiness composta no mesmo ficheiro de 1.972 linhas. Dividir em `metric-names.ts`, `types.ts`, `service.ts`, `mappers/`, `readiness.ts`.
3. [Certo] **Duplicação `api/` vs `app/api/`**: sete rotas antigas na raiz, divergentes das atuais. No Next.js App Router, `api/` na raiz não é roteado — é código morto que vai enganar quem editar o ficheiro errado (incluindo o teu futuro eu, ou um LLM numa sessão nova). Apagar já.
4. [Certo] **Verificação JWT duplicada** entre `middleware.ts` e `lib/auth/session.ts`, com sincronização manual admitida em comentário. Extrair um `lib/auth/verify-edge.ts` importável por ambos.

---

## PARTE IV — Qualidade do Código

**Pontos fortes** [Certo]: TS strict real; naming consistente e descritivo; error handling defensivo por card (fallback para mock com aviso, nunca rebenta a página); o hábito de anotar confiança epistémica nos comentários é excecional — o README funciona como changelog de descobertas empíricas (bug 100x de elevação confirmado por teste cruzado, kJ→kcal, recoveryTime em segundos). Isto é engenharia honesta.

**Code smells e dívida**

| Problema | Ficheiro | Impacto | Solução |
|---|---|---|---|
| [Certo] Código morto (árvore `api/` completa) | raiz | Confusão, edições no sítio errado | `git rm -r api/` |
| [Certo] God-file 1.972 l. | `lib/freddy/metrics.ts` | Manutenção, merge conflicts consigo próprio | Split em 5 módulos |
| [Certo] Mapper desalinhado mantido de propósito | `mapToRunActivityDetail` (comentário admite acesso a shape errado) | Bug latente se alguém chamar `getRunActivityDetail` | Corrigir ou apagar — manter código sabidamente errado é pior que apagar |
| [Certo] Zod, Zustand, react-query instalados sem uso visível | `package.json` | Bundle + falsa sinalização de arquitetura | Usar zod nas rotas ou remover os três |
| [Certo] Números mágicos de fisiologia inline (TSB>5, HRV −5/−10%, stress 30/45, subScore 70+diff*3) | `getComposedReadinessFromWellness` | Impossível calibrar/testar isoladamente | Extrair `readiness-thresholds.ts` com constantes nomeadas — é o teu modelo, trata-o como modelo |
| [Certo] Loaders do dashboard (~380 l. em `page.tsx`) com mocks embutidos por card | `app/dashboard/page.tsx` | Dados de exemplo hardcoded misturados com produção | Mover mocks para `lib/mocks/` e loaders para `lib/loaders/` |
| [Provável] `getActivityDetailFull` só devolve a 1ª atividade do dia | admitido em comentário | Dias com 2+ treinos mostram dados errados sem aviso | Devolver array ou pelo menos flag `multipleActivities` |
| [Certo] Zero testes | — | O parser de texto e os mappers são exatamente o tipo de código que testes de snapshot salvariam | Vitest + fixtures dos outputs reais já colados no README |

**Testabilidade**: paradoxalmente alta — `FreddyDataService` já recebe o client por injeção e os shapes raw estão documentados. Falta só escrever os testes. Prioridade máxima: fixtures de texto real → `parseQueryMetricsText` e `extractValuesByDate`.

---

## PARTE V — Frontend

[Certo] ~30 componentes, split correto server/client (20 client components, os puramente presentacionais sem `"use client"`), design system informal em `components/ui/` (card, stat-tile, radial-gauge, status-badge, bottom-sheet, page-loader, data-freshness-dot). `loading.tsx` por rota. Dark theme (consistente com a tua preferência histórica).

**Componentes bem desenhados**: `data-freshness-dot` + `status-summary` — comunicar staleness de dados é o problema central desta app e a UI trata-o como cidadão de primeira classe. `markdown-lite` próprio evita dependência para render do coach.

**Fraquezas**:
- [Provável] Acessibilidade não tratada (não vi aria-labels, focus management no bottom-sheet, contraste verificado). Para single-user é aceitável; para open-source não.
- [Certo] Sem i18n formal — strings pt-PT hardcoded. Correto para o caso de uso; documentar como decisão.
- [Provável] Recharts + Leaflet client-side em várias páginas sem `next/dynamic` visível em todos os casos — verificar se o Leaflet está lazy (SSR do Leaflet rebenta; presumo que já resolveste, senão não estaria em produção).
- SEO: irrelevante — app privada atrás de auth. Nota N/A, não penaliza.

**Nota frontend: 7/10.** Sólido, funcional, sem sofisticação desnecessária.

---

## PARTE VI — Backend

**Bem feito** [Certo]:
- OTP: hash SHA-256 em repouso, uso único, TTL 10 min, 5 tentativas, cooldown 60s, `randomInt` criptográfico, allowlist de email antes de gerar código. Acima da média para um projeto pessoal.
- Sessão: JWT HS256, cookie httpOnly/secure/lax, falha alta se `SESSION_SECRET` fraca (`session.ts` valida ≥32 chars).
- OAuth Freddy: refresh automático, client registado uma vez com cache Redis, comentários com o que está confirmado vs por testar.

**Problemas**:

1. [Certo] **Bypass total de auth quando `NODE_ENV !== "production"`** em `middleware.ts`. O comentário confia que a Vercel define `NODE_ENV=production`. Verdade para builds Vercel — mas `next start` local, um preview self-hosted, ou qualquer plataforma futura que não defina a var expõe o dashboard e o coach (que gasta quota Groq e lê os teus dados de saúde) sem login. Solução: bypass por variável explícita opt-in (`AUTH_BYPASS=1`) em vez de ausência de produção. Risco atual baixo, custo de correção 5 minutos — corrige.
2. [Certo] **`middleware.ts` usa `process.env.SESSION_SECRET ?? ""`** — se a secret faltar em produção, o middleware rejeita tudo silenciosamente (ok) mas divergindo do comportamento fail-loud de `session.ts`. Unificar.
3. [Certo] **Sem rate limit por IP** nas rotas de auth — o cooldown é por email e só há 1 email válido, portanto o abuso possível é DoS de cooldown contra ti próprio e spam de 403. Menor, mas um `@upstash/ratelimit` são 6 linhas.
4. [Certo] **Sem validação zod nos bodies** — validação manual funciona mas já pagaste a dependência.
5. [Provável] **`/api/coach` sem verificação de sessão dentro da rota** — depende só do middleware. Se o matcher falhar (ou o bypass do ponto 1 estiver ativo), a rota fica aberta. Defense-in-depth: `getSession()` no topo de cada rota sensível.

---

## PARTE VII — Dados

**Modelo** [Certo]: sem persistência própria de séries — cada page load refaz queries ao Freddy/Intervals/strava-lab. O Redis guarda apenas tokens e OTP, não cache de dados.

Aqui está a oportunidade nº 1 de performance e resiliência, e não a estás a explorar: **cache de leitura no Upstash**. Os dados wellness/atividades de dias passados são imutáveis. Um cache `freddy:cache:{metric}:{date}` com TTL infinito para datas < hoje e TTL 15 min para hoje:
- corta 80-90% das chamadas MCP ([Provável] estimativa dado que 7 dias de janela = 6 dias imutáveis),
- elimina o problema de rate limit que já te obrigou a "lotes de 3 com pausa 200ms",
- torna o dashboard resiliente a indisponibilidade do Freddy (serve o último snapshot com freshness dot amarelo — a UI já tem o vocabulário para isto),
- reduz o tempo de load da página principal, que hoje é uma cascata de dezenas de chamadas MCP em cada visita.

Free tier Upstash: 500K comandos/mês — chega de sobra. Complexidade: um wrapper `cachedQueryMetrics` no data-adapter. Esta é a melhoria com melhor rácio impacto/esforço de toda a auditoria.

**Consistência/unidades** [Certo]: os bugs de unidade (elevação ×100, calorias em kJ, recoveryTime em segundos) estão corrigidos *nos pontos de uso*, com a divisão repetida em pelo men 2 sítios (`getActivityDetailFull` e YoY). Centralizar num módulo `unit-corrections.ts` — a correção espalhada vai divergir um dia.

---

## PARTE VIII — Performance

- [Certo] Gargalo principal: latência serial+paralela de chamadas MCP por page load, agravada pelo throttle auto-imposto (200-250ms entre lotes). O `maxDuration=60` existe precisamente porque isto é lento. A cache da Parte VII resolve.
- [Certo] `force-dynamic` em tudo — correto sem cache, desnecessário depois dela; páginas podem passar a `revalidate` curto.
- [Provável] Bundle: Recharts + Leaflet + deps não usadas (zustand/react-query/zod se não usados). `next build` com analyzer confirmaria; estimativa de poupança 100-200KB gzip.
- [Certo] `getActivityDetailFull` reconstrói distância acumulada por integração de speed×dt — correto, mas O(n) por render de detalhe; irrelevante a esta escala. Não otimizar.

---

## PARTE IX — Segurança

Contra OWASP Top 10, resumo honesto: a superfície é pequena (single-user, sem BD SQL, sem input rico).

- **Injection**: sem SQL. [Provável] Prompt injection no coach é teoricamente possível via nomes de atividades Garmin injetados no contexto — irrelevante quando o único utilizador és tu.
- **Broken auth**: ver Parte VI pontos 1-2 — o bypass NODE_ENV é o único achado real.
- **Sensitive data**: tokens OAuth Freddy em Redis em claro [Certo]. Aceitável (Upstash TLS + token de acesso), mas o refresh_token de 60 dias dá acesso total aos teus dados de saúde — considera encriptação at-rest com a SESSION_SECRET (AES-GCM, ~20 linhas) se o projeto for público como template.
- **Secrets**: nenhum segredo commitado ([Certo] `.env.example` presente, `.gitignore` correto). `STRAVA_LAB_API_KEY` como shared secret entre duas apps tuas — ok.
- **XSS**: `markdown-lite` próprio — [Provável] risco se renderizar HTML do output do LLM; confirmar que só suporta subset e escapa por defeito.
- **CSRF**: cookies sameSite=lax + rotas POST JSON — mitigado na prática.
- **Dependências**: sem lockfile audit em CI. `npm audit` num GitHub Action semanal custa nada.
- **Rate limiting**: ausente por IP (menor, ver VI.3).

Classificação de segurança para o contexto real (app pessoal): **boa**. Para publicação como template: exigiria os 4 pontos acima.

---

## PARTE X — DevOps

[Certo] Estado: inexistente enquanto disciplina. Sem `.github/workflows`, sem testes a correr, sem badge, sem Dependabot, sem observabilidade além de `console.warn` (que na Vercel vai para logs de função, efémeros no Hobby).

Mínimo viável (1 tarde):
1. GitHub Action: `npm ci && npm run typecheck && npm run lint && npm test` em cada push.
2. Dependabot mensal.
3. `humanizeError` já existe — acrescentar um log estruturado (JSON) por falha de fonte de dados, para conseguires responder a "desde quando é que o Freddy está a falhar?" sem adivinhar.
4. Rollback = redeploy de commit anterior na Vercel — suficiente, documentar no README.

Docker/containers: não acrescentam nada aqui. Não recomendo.

---

## PARTE XI — Inteligência Artificial

**Existente** [Certo]: `/api/coach` → Groq `llama-3.3-70b-versatile`. Arquitetura: contexto composto rico (readiness composto com pesos explicados, TSB/CTL/ATL do dia, zonas FC reais do Strava, meteo com regras de ajuste de pace, treino já feito hoje, staleness explícita) + system prompt com regras anti-alucinação e formato duplo (Markdown humano + bloco `---ICU_WORKOUT---` parseável) + push para Intervals.icu. Sem memória entre sessões, sem RAG, sem embeddings, sem agentes.

Avaliação direta: **o prompt engineering está acima da média** — instruir o modelo a distinguir TSB de Training Readiness e a declarar staleness é exatamente o que a maioria dos "AI coaches" comerciais não faz. O elo fraco é o modelo: [Provável] o Llama 3.3 70B prescreve treinos genéricos e comete erros de aritmética de pace/zonas sob pressão. Dois upgrades ordenados por retorno:

1. **Memória de plano** (sem mudar de modelo): guardar no Redis os últimos N treinos prescritos + feedback ("fiz/não fiz, como correu") e injetar no contexto. Um coach que não se lembra do treino que prescreveu ontem não é um coach, é um gerador. Esforço: baixo. Impacto: transforma o produto.
2. **Modelo melhor para prescrição, mantendo Groq para chat**: Claude Sonnet via API para o pedido "treino específico" (poucos pedidos/dia, custo ~cêntimos) e Llama para conversação. A qualidade da periodização é onde o teu objetivo sub-3h vive ou morre.

Funcionalidades IA futuras com dados que **já tens**: deteção de decoupling/cardiac drift por atividade (streams HR+speed já chegam em `activityDetail_samples`), alerta de ramp rate (wellness_rampRate já vem do Intervals.icu e não é usado em card nenhum [Certo]), análise pós-treino automática comparando prescrito vs executado (fecha o loop do ponto 1). MCP/agents: já és consumidor MCP — não precisas de agentes para este escopo; seria complexidade sem retorno.

---

## PARTE XII — UX

**Forte** [Certo]: honestidade de dados como princípio de UX — freshness dots, avisos de mock, staleness em dias, fonte identificada por card. Fluxo de treino do dia: pergunta → treino formatado → botão push → aparece no Garmin via ICU. Poucas plataformas fecham este ciclo.

**Melhorias concretas**:
1. Load time da página principal (ver VII/VIII) é a fricção nº 1 — cache resolve.
2. [Certo] `getRacePredictions` existe e (segundo o README) previsões estão implementadas — mas com o teu objetivo sub-3h, o dashboard devia ter um card permanente "distância ao objetivo" (previsão maratona vs 2:59:59, tendência 90 dias). Os dados já lá estão; é só composição.
3. Hipnograma de sono: `sleepLevelsMap` já confirmado no raw [Certo], comentário admite que seria útil — prioridade média.
4. Mobile: [Suposição] não testei rendering; com bottom-sheet e Tailwind presumo razoável.

---

## PARTE XIII — Benchmark

| Plataforma | Fazem melhor | Fazes melhor |
|---|---|---|
| Garmin Connect | Profundidade de métricas proprietárias (Running Dynamics — que [Certo] confirmaste não chegarem via Freddy), UX polida | Frescura composta multi-fonte; eles nunca cruzam com Intervals.icu |
| Strava | Social, segmentos, mapas | Análise fisiológica (Strava é raso nisto); tu integras via strava-lab só o que interessa |
| Intervals.icu | PMC completo, power curves, análise por atividade insuperável no free tier | Coach IA acionável + push de treinos; ICU é passivo |
| Runalyze | Modelos (TRIMP, marathon shape, monotony/strain) | Nada — Runalyze é o teu benchmark de métricas em falta (Parte XV) |
| TrainingPeaks | PMC canónico, mercado de coaches | Custo zero; TP paywalls tudo |
| Final Surge / Stryd PC / Golden Cheetah | Planos estruturados / power nativo / análise desktop profunda | Integração web leve e IA |

**Conclusão de benchmark**: não tentes replicar Intervals.icu — já o consomes. A tua vantagem defensável é a camada de *síntese e ação* por cima das fontes. Cada métrica que reimplements e o ICU já calcula é esforço desperdiçado.

---

## PARTE XIV — Análise como Treinador de Corrida

Para um maratonista intermédio-avançado com objetivo sub-3h (o utilizador real):

**Úteis e bem escolhidos** [Certo no código]: composto de readiness (TSB+HRV+RHR+sono+stress) — metodologicamente defensável e transparente; CTL/ATL/TSB reais do ICU; ACWR Garmin como complementar; zonas FC reais nas prescrições; meteo com ajuste de pace.

**Redundantes**: VO2max com 4 fontes é rigor de dados, mas para decisão de treino uma chega — as outras 3 são ruído no ecrã se todas visíveis. Steps/floors: métricas de wellness genérico, não de performance de maratona; ocupam espaço que devia ser da progressão de longos.

**Em falta, por ordem de importância para sub-3h**:
1. **Análise do longo semanal** — decoupling aeróbico (Pa:HR 1ª vs 2ª metade) e drift cardíaco. É O preditor de prontidão de maratona e tens os streams para o calcular.
2. **Volume em zona/distribuição de intensidade** (80/20, polarizado) — `hrTimeInZone_0..6` já existe nos metric names [Certo] e não vi card a usá-lo.
3. **Ramp rate com alerta** — o campo vem do ICU e é ignorado.
4. **Prescrito vs executado** — sem isto, o coach não aprende e tu não medes aderência.
5. **Race readiness composto** (previsão + longos ≥30km nas últimas 8 semanas + volume em MP pace) nas 12 semanas pré-prova.

Para iniciantes/trail/ultra: a app não serve e não deve tentar servir — sem métricas de vert/tempo em pé/nutrição. Foco correto.

---

## PARTE XV — Métricas Recomendadas (priorizadas, não a lista telefónica)

Discordo da premissa da tua lista de ~60 métricas: mais métricas ≠ melhor plataforma, e metade delas (Stryd LSS, Critical Power, Running Effectiveness) exige dados de power de qualidade que [Certo] os teus streams têm (power existe em `activityDetail_samples`) mas cuja fiabilidade em power de pulso Garmin é discutível. Prioridade por impacto real no teu objetivo:

**P0 (dados já disponíveis, cálculo simples)**
- *Aerobic Decoupling* por atividade: split da atividade em metades, ratio (pace/HR)₂/(pace/HR)₁; >5% no longo = base aeróbica insuficiente. Visual: badge % no detalhe da atividade.
- *Tempo em zonas semanal* + rácio 80/20: barras empilhadas semanais de `hrTimeInZone_*`.
- *Ramp rate* com semáforo (>1.5 CTL/semana sustentado = risco).
- *TSB no dia da prova* projetado (já tens CTL/ATL — projeção linear com o plano).

**P1 (cálculo médio)**
- *Efficiency Factor* (velocidade normalizada/HR médio) em corridas fáceis — tendência de economia sem lab.
- *Training Monotony & Strain* (Foster): média/desvio-padrão da carga diária semanal — deteta semanas perigosamente uniformes.
- *Race Predictor próprio* (Riegel sobre best efforts do Strava, que já tens via strava-lab) vs previsão Garmin — quando divergem, é informação.

**P2 (só se sobrar tempo)**
- Hipnograma, curvas HR-duração, VDOT, heat adaptation.

**Não implementar**: TRIMP/HRSS/rTSS/RSS — são reformulações da carga que o ICU já te dá; Critical Power/Speed sem power meter dedicado; injury risk "prediction" — não há modelo validado que funcione com estes dados, e vender um número inventado como risco de lesão é exatamente o tipo de coisa que o teu código, corretamente, recusa fazer.

---

## PARTE XVI/XVII — Roadmap (consolidado)

| # | Item | Impacto | Esforço | Risco | Quando |
|---|---|---|---|---|---|
| 1 | Cache Redis de leituras MCP (datas passadas imutáveis) | Muito alto | Baixo | Baixo | Semana 1 |
| 2 | Apagar `api/` morto + artefactos raiz; split de `metrics.ts` | Alto | Baixo | Nenhum | Semana 1 |
| 3 | Testes: fixtures reais → parser + mappers + readiness thresholds; CI | Alto | Médio | Nenhum | Mês 1 |
| 4 | Corrigir bypass NODE_ENV + unificar verificação JWT | Médio | Trivial | Nenhum | Semana 1 |
| 5 | Card decoupling/drift no detalhe de atividade | Alto (treino) | Médio | Baixo | Mês 1 |
| 6 | Distribuição de intensidade 80/20 semanal | Alto (treino) | Baixo | Baixo | Mês 1-2 |
| 7 | Memória do coach (prescrito vs executado no Redis) | Muito alto | Médio | Baixo | Mês 2 |
| 8 | Card "distância ao sub-3h" (previsão vs objetivo, tendência) | Alto (motivação) | Baixo | Baixo | Mês 2 |
| 9 | Ramp rate + monotony/strain com alertas | Médio | Baixo | Baixo | Mês 2-3 |
| 10 | Upgrade seletivo de modelo para prescrição de treinos | Médio-alto | Baixo | Custo ~€1-3/mês | Mês 3 |
| 11 | Encriptar tokens at-rest + LICENSE + docs genéricas → publicar como template | Médio (OSS) | Médio | Baixo | Mês 3-6 |
| 12 | Hipnograma; race readiness pré-prova (12 semanas) | Médio | Médio | Baixo | Mês 6+ |
| 13 | Retry/negociação de formato com Freddy (pedir JSON estruturado ao mantainer do MCP em vez de scraping) | Alto (robustez) | Fora do teu controlo | — | Abrir issue já |

24 meses: só faz sentido falar de multi-user se decidires publicar — e nesse caso a decisão estrutural (auth multi-tenant, tokens por utilizador, BD real) tem de vir antes de qualquer feature. Não acumules mais features single-user se essa for a intenção.

---

## PARTE XVIII — Conclusão

**Forças**: honestidade epistémica no código (rara e valiosa — o repo é auto-documentado contra alucinações de sessões LLM futuras); pipeline coach→ICU→Garmin único; correções de dados validadas empiricamente; auth acima da média para projeto pessoal.

**Fragilidades**: fundação em parsing de texto não contratual; zero testes precisamente onde os testes mais valeriam; god-file; código morto; ausência de cache que torna a app lenta e frágil a rate limits que tu próprio documentaste.

**Ameaça principal**: dependência total do freddy.coach — formato de output, disponibilidade e modelo de negócio de um terceiro. A cache (nº 1) e um pedido de output JSON estruturado (nº 13) são as duas mitigações.

**Potenciais**: comercial 3/10 (ver Parte I); open-source como template 7/10; académico/federações — não, e ainda bem que não tenta; treinadores — só depois do item 7 (memória prescrito/executado é o que um treinador humano usaria).

**Classificação global: 64/100.** Decomposição: dados & integrações 8/10 (o trabalho de engenharia reversa é o melhor do projeto), arquitetura 6/10, código 6/10, testes/DevOps 1/10, UX 7/10, IA 7/10, segurança 7/10 (para o contexto), diferenciação 8/10. O que separa 64 de 80 não são features novas — são os itens 1-4 do roadmap, que custam duas semanas.

**Top melhorias por retorno** (a lista de 50 pedida seria padding — abaixo dos ~15 primeiros o retorno é marginal e eu estaria a inventar volume): ver tabela XVI/XVII, ordenada exatamente por esse critério.
