# Contexto do projeto (para sessões Claude)

- App single-user Next.js 15 no Vercel Hobby. Dados via Freddy MCP (Garmin+Intervals.icu).
- [Certo] O Freddy devolve TEXTO humano, não JSON — parser em lib/freddy/data-adapter.ts.
- [Certo] Bugs de unidades confirmados: summarizedActivity_elevationGain ÷100; calories kJ→kcal ÷4.184; recoveryTime em SEGUNDOS.
- [Certo] Freddy limita concorrência (~3 pedidos) e devolve 429 acima disso.
- Cache por (métrica, data) em lib/freddy/cache.ts; CACHE_VERSION invalida tudo.
- [Certo] Regressão conhecida: converter days→start/end faz algumas métricas devolver vazio; existe fallback legacy-days no data-adapter.
- Convenção: anotar afirmações no código com [Certo]/[Provável]/[Suposição].
- Roadmap: itens 1,2,4 feitos; em curso: rate limiting global + fecho de clients MCP.