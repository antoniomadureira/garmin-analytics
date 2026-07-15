# Garmin Analytics — Freddy Running Intelligence

Dashboard pessoal de inteligência de corrida, single-user, 100% free tier.
Agrega Garmin (via [Freddy MCP](https://freddy.coach)), Intervals.icu e
Strava (via strava-lab) num painel de prontidão diária, análise de treino e
acompanhamento de objetivo de maratona, com um coach IA que avalia — não
substitui — o plano de treino do atleta.

## Stack

- **Next.js 15** (App Router, Server Components) · React 19 · TypeScript strict · Tailwind
- **Vercel Hobby** (deploy) · **Upstash Redis** (cache, tokens, memória do coach)
- **Freddy MCP** (dados Garmin via `@modelcontextprotocol/sdk`, StreamableHTTP)
- **Intervals.icu** (PMC, wellness, push de treinos) · **strava-lab** (records, zonas, gear)
- **Groq Llama 3.3 70B** (coach) · **Resend** (login OTP) · **vaul** (drawers)
- **Vitest** (~394 testes) · **GitHub Actions** (typecheck + lint + test)

## Funcionalidades

### Prontidão diária
Score composto (HRV, FC repouso, bateria, sono, stress, TSB) com convenção
de dias correta: sinais da manhã leem a noite passada; carga (CTL/ATL/TSB)
lê até ontem (convenção PMC). Faixa ambiental (meteo + qualidade do ar,
localização por geolocalização do browser).

### Coach IA com memória — três modos
- **Prescribe**: treino do dia a partir de prontidão, meteo, AQI, objetivo
  de prova e histórico. Push de um clique para o Intervals.icu → Garmin.
- **Evaluate**: com um plano no campo "Plano de hoje" (ex: plano Kiprun),
  veredicto ✅/⚠️/🛑 contra o estado do atleta — o coach avalia o plano em
  vez de o substituir.
- **Review**: após o treino, comparação execução vs plano com desvios
  calculados em código.

A memória (prescrito vs executado, Redis) obriga o coach a citar o último
treino com números reais ("📊 Último treino: 18.7km a 4:46/km") antes de
prescrever. Toda a aritmética é feita em TypeScript — o LLM cita valores
pré-formatados, nunca calcula.

### Análise de treino
- Prescrito vs executado com **aerobic decoupling** (só em execução
  contínua — guardrails de CV de pace), badge por limiares.
- **Distribuição de intensidade 80/20** semanal (zonas FC do Intervals).
- **Ramp rate + monotonia/strain (Foster)** sobre carga diária bruta, com
  linhas de interpretação determinísticas e síntese de risco combinado.
- Detalhe de atividade: mapa, laps, streams FC/pace/altitude/cadência,
  melhores tempos e segmentos Strava, tempo em zonas (min + %).

### Rumo ao sub-3h
Card de objetivo (Maratona de Lisboa 10/10/2026, 3:00:00): semanas
restantes e fase do ciclo calculadas em código; previsão por race
predictions do Garmin quando frescas, senão **Riegel** sobre o melhor
esforço *representativo* recente (filtro de pace vs esforço fácil, janela
com aviso de staleness) — com honestidade explícita quando os dados são
velhos ("corre um 10K de controlo").

### Sono
Score, duração (eixo h:mm), **hipnograma** da última noite (fases por
atigrafia), tendência profundo/REM e alertas por limiares com ações
concretas — e um rodapé deliberado de humildade epistémica sobre a margem
de erro dos relógios.

## Arquitetura de dados (o difícil)

O Freddy MCP devolve **texto humano**, não JSON — o parser extrai blocos
`raw: {...}` por contagem de chavetas. Cliente MCP singleton + semáforo
global (2 em voo, retry só em 429). Cache Redis por (métricas, data) com
imutabilidade de datas passadas, sentinels para dias vazios e fallback
legacy-days. Correções de unidades confirmadas empiricamente (elevação
÷100, kJ→kcal, recoveryTime em segundos). Pace agregado sempre por média
harmónica (distância/tempo), nunca média aritmética de amostras.

## Limitações conhecidas (integração de terceiros)

- **ICU→Garmin**: workouts que misturam targets de HR e Pace perdem todos
  os targets no relógio → treinos de corrida são pace-only numérico.
- **ICU→Garmin**: blocos de repetição (`Nx`) chegam ao relógio como nota de
  texto (bug do FIT generator do ICU) — a UI avisa; contínuos chegam
  estruturados.
- **Kiprun Pace**: sem API — integração via campo manual "Plano de hoje".

## Desenvolvimento

```bash
npm install
npm run dev            # AUTH_BYPASS=1 salta o login fora de produção
npm run typecheck      # obrigatório antes de push
npm run build          # idem — Vercel não corre typecheck estrito
npm test               # Vitest; CI corre contra fixtures sintéticas
npm run fixtures:capture   # captura output MCP real (local, .gitignore)
```

Regras de trabalho, protocolos de debugging e o histórico de decisões vivem
no `CLAUDE.md` — leitura obrigatória antes de qualquer alteração.

## Licença / privacidade

Projeto pessoal. As fixtures em `tests/fixtures/` contêm dados fisiológicos
reais e estão excluídas do repositório; o CI usa réplicas sintéticas.