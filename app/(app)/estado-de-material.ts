/** How the state of a material reads, and the tokens that colour its chip. */
export const ESTADO: Record<string, { texto: string; clases: string }> = {
  procesando: { texto: "Procesando", clases: "bg-aviso-fondo text-aviso-tinta" },
  listo: { texto: "Listo", clases: "bg-ok-fondo text-ok-tinta" },
  fallido: { texto: "No se pudo procesar", clases: "bg-error-fondo text-error-tinta" },
}

export const ETIQUETA_DE_TIPO: Record<string, string> = {
  documento: "Documento",
  link: "Link",
  audio: "Audio",
  video: "Video",
  imagen: "Imagen",
  post: "Post",
}

interface EstadoDeProceso {
  estado: string
  motivo_fallo: string | null
  costo_estimado_usd: number | null
  costo_confirmado_en: string | null
}

/** A long material the task stopped before spending: it waits for a person to confirm what it will cost. */
export function esperaConfirmacion(material: EstadoDeProceso): boolean {
  return (
    material.estado === "procesando" && material.costo_estimado_usd !== null && material.costo_confirmado_en === null
  )
}

/** A material that failed, or that the monthly cap stopped (still `procesando`, but with the reason): retryable. */
export function sePuedeReintentar(material: EstadoDeProceso): boolean {
  if (esperaConfirmacion(material)) return false
  return material.estado === "fallido" || (material.estado === "procesando" && material.motivo_fallo !== null)
}

/** Really working on it: the page keeps asking while any material is. A cap-stopped or waiting one does not. */
export function estaProcesando(material: EstadoDeProceso): boolean {
  return material.estado === "procesando" && material.motivo_fallo === null
}
