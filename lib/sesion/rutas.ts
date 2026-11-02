export const RUTA_DE_INGRESO = "/ingreso"
export const RUTA_DEL_PUENTE = "/ingreso/puente"

export type DecisionDeRuta = "seguir" | "a_ingreso" | "a_inicio"

/** The optimistic check of `proxy.ts`: the real authorisation is Coni's row in `miembros`, checked on the server. */
export function decidirRuta(entrada: { ruta: string; haySesion: boolean }): DecisionDeRuta {
  // The bridge from Conidolly (change 29a) replaces whatever session the browser has: it runs with one or without.
  if (entrada.ruta === RUTA_DEL_PUENTE) return "seguir"
  const enIngreso = entrada.ruta === RUTA_DE_INGRESO || entrada.ruta.startsWith(`${RUTA_DE_INGRESO}/`)
  if (!entrada.haySesion) return enIngreso ? "seguir" : "a_ingreso"
  return enIngreso ? "a_inicio" : "seguir"
}
