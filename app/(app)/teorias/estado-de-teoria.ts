/** The tokens that colour the chip of each state of a theory. */
export const CLASES_DE_ESTADO_DE_TEORIA: Record<string, string> = {
  sintetizando: "bg-aviso-fondo text-aviso-tinta",
  borrador: "bg-hundido text-apagado",
  guardada: "bg-ok-fondo text-ok-tinta",
  fallida: "bg-error-fondo text-error-tinta",
}

export const claseDeEstadoDeTeoria = (estado: string): string =>
  CLASES_DE_ESTADO_DE_TEORIA[estado] ?? "bg-hundido text-apagado"
