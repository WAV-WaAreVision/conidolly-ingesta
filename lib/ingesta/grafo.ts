import type { ElementDefinition } from "cytoscape"

export const TIPOS_DE_VINCULO = ["complementa", "amplia", "contradice", "mismo_concepto", "ejemplo_de"] as const
export type TipoDeVinculo = (typeof TIPOS_DE_VINCULO)[number]

export const ETIQUETA_DE_VINCULO: Record<TipoDeVinculo, string> = {
  complementa: "Complementa",
  amplia: "Amplía",
  contradice: "Contradice",
  mismo_concepto: "Mismo concepto",
  ejemplo_de: "Ejemplo de",
}

export const ETIQUETA_DE_ESTADO_DE_VINCULO: Record<string, string> = {
  sugerido: "Sugerido",
  aceptado: "Aceptado",
  descartado: "Descartado",
}

/** Names of the custom properties of `globals.css`; the screen resolves them to colours at runtime. */
export const TOKENS_DE_CATEGORIA = [
  "--grafo-categoria-1",
  "--grafo-categoria-2",
  "--grafo-categoria-3",
  "--grafo-categoria-4",
  "--grafo-categoria-5",
  "--grafo-categoria-6",
] as const
export const TOKEN_DE_TEORIA = "--grafo-teoria"
export const TOKEN_DE_ARISTA = "--grafo-arista"
export const TOKEN_DE_ARISTA_SUGERIDA = "--grafo-arista-sugerida"
export const TOKEN_DE_TEXTO = "--grafo-texto"
export const TOKEN_DE_SELECCION = "--grafo-seleccion"

export interface MaterialDelGrafo {
  id: string
  titulo: string | null
  autor: string | null
  categoria: string
}

export interface VinculoDelGrafo {
  material_a: string
  material_b: string
  tipo: string
  relevancia: number
  estado: string
  razon: string | null
  cita_a: string | null
  cita_b: string | null
}

export interface TeoriaDelGrafo {
  id: string
  nombre: string
  materiales: string[]
}

export interface FiltrosDelGrafo {
  categoria?: string
  autor?: string
  tipo?: string
  relevanciaMinima?: number
}

/** The same category always gets the same token: a hash of its name picks one of the six. */
export function tokenDeCategoria(categoria: string): (typeof TOKENS_DE_CATEGORIA)[number] {
  let hash = 0
  for (const letra of categoria) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0
  return TOKENS_DE_CATEGORIA[hash % TOKENS_DE_CATEGORIA.length] ?? TOKENS_DE_CATEGORIA[0]
}

const TAMANO_BASE = 26
const TAMANO_POR_VINCULO = 6
const TAMANO_MAXIMO = 62
const TAMANO_DE_TEORIA = 40

function materialesVisibles(materiales: MaterialDelGrafo[], filtros: FiltrosDelGrafo): MaterialDelGrafo[] {
  return materiales.filter(
    (m) => (!filtros.categoria || m.categoria === filtros.categoria) && (!filtros.autor || m.autor === filtros.autor),
  )
}

/** The links that draw: not discarded, both materials visible, and the type and relevance filters met. */
export function filtrarVinculos(
  materiales: MaterialDelGrafo[],
  vinculos: VinculoDelGrafo[],
  filtros: FiltrosDelGrafo,
): VinculoDelGrafo[] {
  const ids = new Set(materialesVisibles(materiales, filtros).map((m) => m.id))
  return vinculos.filter(
    (v) =>
      v.estado !== "descartado" &&
      ids.has(v.material_a) &&
      ids.has(v.material_b) &&
      (!filtros.tipo || v.tipo === filtros.tipo) &&
      v.relevancia >= (filtros.relevanciaMinima ?? 0),
  )
}

export const idDeVinculo = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Cytoscape elements of the graph. Colours travel as token names and sizes as numbers: the screen turns tokens into
 * colours at runtime. A discarded link never draws; a filter that hides a material hides the links that touch it.
 */
export function aElementosDelGrafo(
  materiales: MaterialDelGrafo[],
  vinculos: VinculoDelGrafo[],
  teorias: TeoriaDelGrafo[],
  filtros: FiltrosDelGrafo,
): ElementDefinition[] {
  const visibles = materialesVisibles(materiales, filtros)
  const idsVisibles = new Set(visibles.map((m) => m.id))
  const conocidos = new Set(materiales.map((m) => m.id))

  const aceptados = new Map<string, number>()
  for (const v of vinculos) {
    if (v.estado !== "aceptado" || !conocidos.has(v.material_a) || !conocidos.has(v.material_b)) continue
    aceptados.set(v.material_a, (aceptados.get(v.material_a) ?? 0) + 1)
    aceptados.set(v.material_b, (aceptados.get(v.material_b) ?? 0) + 1)
  }

  const nodos: ElementDefinition[] = visibles.map((m) => ({
    group: "nodes",
    data: {
      id: m.id,
      label: m.titulo ?? "Sin título",
      tipoDeNodo: "material",
      shape: "ellipse",
      token: tokenDeCategoria(m.categoria),
      size: Math.min(TAMANO_MAXIMO, TAMANO_BASE + TAMANO_POR_VINCULO * (aceptados.get(m.id) ?? 0)),
    },
  }))

  const nodosDeTeoria: ElementDefinition[] = teorias.map((t) => ({
    group: "nodes",
    data: {
      id: t.id,
      label: t.nombre,
      tipoDeNodo: "teoria",
      shape: "diamond",
      token: TOKEN_DE_TEORIA,
      size: TAMANO_DE_TEORIA,
    },
  }))

  const aristasDeVinculo: ElementDefinition[] = filtrarVinculos(materiales, vinculos, filtros).map((v) => ({
    group: "edges",
    data: {
      id: idDeVinculo(v.material_a, v.material_b),
      source: v.material_a,
      target: v.material_b,
      tipoDeArista: "vinculo",
      tipo: v.tipo,
      estado: v.estado,
      relevancia: v.relevancia,
      width: 1 + v.relevancia,
      dashed: v.estado === "sugerido",
      token: v.estado === "sugerido" ? TOKEN_DE_ARISTA_SUGERIDA : TOKEN_DE_ARISTA,
      razon: v.razon,
      citaA: v.cita_a,
      citaB: v.cita_b,
    },
  }))

  const aristasDeTeoria: ElementDefinition[] = teorias.flatMap((t) =>
    t.materiales
      .filter((id) => idsVisibles.has(id))
      .map((id) => ({
        group: "edges" as const,
        data: {
          id: `${t.id}|${id}`,
          source: t.id,
          target: id,
          tipoDeArista: "teoria",
          width: 1,
          dashed: false,
          token: TOKEN_DE_TEORIA,
        },
      })),
  )

  return [...nodos, ...nodosDeTeoria, ...aristasDeVinculo, ...aristasDeTeoria]
}
