import { z } from "zod"
import { ROLES, TIPOS_DE_MATERIAL } from "./modelo"

export const ESTADOS_DE_MATERIAL = ["procesando", "listo", "fallido"] as const

export interface FiltrosDeMateriales {
  autor?: string
  rol?: (typeof ROLES)[number]
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
  const autor = leer(z.string().uuid(), params.autor)
  const rol = leer(z.enum(ROLES), params.rol)
  const tipo = leer(z.enum(TIPOS_DE_MATERIAL), params.tipo)
  const estado = leer(z.enum(ESTADOS_DE_MATERIAL), params.estado)
  if (autor) filtros.autor = autor
  if (rol) filtros.rol = rol
  if (tipo) filtros.tipo = tipo
  if (estado) filtros.estado = estado
  return filtros
}

export function hayFiltros(filtros: FiltrosDeMateriales): boolean {
  return Object.keys(filtros).length > 0
}
