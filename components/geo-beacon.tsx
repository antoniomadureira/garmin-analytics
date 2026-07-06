"use client";

import { useEffect } from "react";

// [Suposição] navigator.geolocation pede permissão explícita ao utilizador.
// Se negado, o erro é engolido e o cookie nunca é escrito — o servidor
// cai para a próxima fonte da cadeia (env / geo-IP / default Porto).
export function GeoBeacon() {
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        document.cookie =
          `geo=${coords.latitude},${coords.longitude}; max-age=86400; path=/; samesite=lax`;
      },
      () => { /* silencioso se negado ou timeout */ },
      { timeout: 5000 },
    );
  }, []);

  return null;
}
