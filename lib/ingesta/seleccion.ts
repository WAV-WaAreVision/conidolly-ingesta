export const MINIMO_PARA_SINTETIZAR = 2
export const MAXIMO_PARA_SINTETIZAR = 8

/** Taps a material in or out of the selection; a ninth is refused and `lleno` says why. */
export function alternarSeleccion(actual: readonly string[], id: string): { seleccion: string[]; lleno: boolean } {
  if (actual.includes(id)) return { seleccion: actual.filter((elegido) => elegido !== id), lleno: false }
  if (actual.length >= MAXIMO_PARA_SINTETIZAR) return { seleccion: [...actual], lleno: true }
  return { seleccion: [...actual, id], lleno: false }
}

export const puedeSintetizar = (cantidad: number): boolean =>
  cantidad >= MINIMO_PARA_SINTETIZAR && cantidad <= MAXIMO_PARA_SINTETIZAR
