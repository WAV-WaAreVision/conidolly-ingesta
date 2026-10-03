import { z } from "zod"
import { TIPOS_DE_MATERIAL } from "./modelo"

export const ESTADOS_DE_MATERIAL = ["procesando", "listo", "fallido"] as const

export interface FiltrosDeMateriales {
  categoria?: string
  autor?: string
  tipo?: (typeof TIPOS_DE_MATERIAL)[number]
  estado?: (typeof ESTADOS_DE_MATERIAL)[number]
}

type Params = Record<string, string | string[] | undefined>

const primero = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor)

function leer<T>(esquema: z.ZodType<T>, valor: string | string[] | undefined): T | undefined {
  const leido = esquema.safeParse(primero(valor)?.trim())
  return leido.success ? leido.data : undefined
}

/** The filters of the list from the URL's search params; whatever is not a valid value is ignored, never an error. */
export function leerFiltros(params: Params): FiltrosDeMateriales {
  const filtros: FiltrosDeMateriales = {}
  const categoria = leer(z.string().uuid(), params.categoria)
  const autor = leer(z.string().min(1).max(200), params.autor)
  const tipo = leer(z.enum(TIPOS_DE_MATERIAL), params.tipo)
  const estado = leer(z.enum(ESTADOS_DE_MATERIAL), params.estado)
  if (categoria) filtros.categoria = categoria
  if (autor) filtros.autor = autor
  if (tipo) filtros.tipo = tipo
  if (estado) filtros.estado = estado
  return filtros
}

export function hayFiltros(filtros: FiltrosDeMateriales): boolean {
  return Object.keys(filtros).length > 0
}
