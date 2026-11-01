import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import { Ubicacion } from "./ficha"
import { ERROR_SOLICITUD } from "./modelo"
import { leerTodas } from "./paginas"
import { type DepsSubir, exigirMiembro } from "./subir"

type Db = SupabaseClient<Database>

const AFIRMACION_INEXISTENTE = "P0002"

export interface Pilar {
  id: string
  nombre: string
}

export interface TemaResumido {
  id: string
  nombre: string
  descripcion: string | null
  categoriaId: string | null
  afirmaciones: number
  autores: number
  evidencia: Record<string, number>
  cubiertoPorConi: boolean
}

export interface AfirmacionDeTema {
  id: string
  texto: string
  cita: string
  ubicacion: Ubicacion | null
  tipo: string
  evidencia: string
  publico: string | null
  dolor: string | null
  emocion: string | null
  gancho: string | null
}

export interface TemaLeido {
  tema: { id: string; nombre: string; descripcion: string | null; alias: string[] }
  autores: { autor: { id: string; nombre: string; credencial: string | null }; afirmaciones: AfirmacionDeTema[] }[]
}

const PASOS_MAXIMOS_DE_FUSION = 5

/**
 * The topic that is alive where `id` leads: itself, or the one that absorbed it following `fusionado_en`. Null when a
 * step is missing or not hers to see, or when the chain does not end within a few steps (a loop).
 */
export async function destinoDeTema(db: Db, id: string): Promise<string | null> {
  let actual = id
  for (let paso = 0; paso <= PASOS_MAXIMOS_DE_FUSION; paso++) {
    const { data, error } = await db.from("temas").select("id, fusionado_en").eq("id", actual).maybeSingle()
    if (error) throw new Error(`No pude leer el tema ${actual}: ${error.message}`, { cause: error })
    if (!data) return null
    if (data.fusionado_en === null) return data.id
    actual = data.fusionado_en
  }
  return null
}

const cuentas = z.record(z.string(), z.number())

/** `jsonb` that is not the shape the database writes is read as empty rather than breaking the whole list. */
const ubicacionLeida = (valor: unknown): Ubicacion | null => {
  const leida = Ubicacion.safeParse(valor)
  return leida.success ? leida.data : null
}

/** The categories a topic can be filtered by: active ones only (retired pillars keep their rows, not their place). */
export async function listarPilares(db: Db): Promise<Pilar[]> {
  const { data, error } = await db.from("categorias").select("id, nombre").eq("activa", true)
  if (error) throw new Error(`No pude leer los pilares: ${error.message}`, { cause: error })
  return data.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

/** The topics with their numbers: most distinct authors first, then most claims. A pillar narrows them. */
export async function listarTemas(db: Db, filtros: { pilar?: string }): Promise<TemaResumido[]> {
  const filas = await leerTodas("los temas", (desde, hasta) => {
    const consulta = db.from("temas_resumen").select("*").order("id").range(desde, hasta)
    return filtros.pilar ? consulta.eq("categoria_id", filtros.pilar) : consulta
  })
  return filas
    .flatMap((fila) =>
      fila.id === null || fila.nombre === null ? [] : [{ ...fila, id: fila.id, nombre: fila.nombre }],
    )
    .map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      categoriaId: fila.categoria_id,
      afirmaciones: fila.afirmaciones ?? 0,
      autores: fila.autores ?? 0,
      evidencia: cuentas.catch({}).parse(fila.evidencia),
      cubiertoPorConi: fila.cubierto_por_coni === true,
    }))
    .sort((a, b) => b.autores - a.autores || b.afirmaciones - a.afirmaciones || a.nombre.localeCompare(b.nombre, "es"))
}

const COLUMNAS_DE_AFIRMACION =
  "id, texto, cita, ubicacion, tipo, evidencia, publico, dolor, emocion, gancho, autor_id, autores ( id, nombre, credencial )"

/** One topic with its visible claims grouped by author; null when it is missing, merged into another or not hers to see. */
export async function leerTema(db: Db, id: string): Promise<TemaLeido | null> {
  const { data: tema, error } = await db
    .from("temas")
    .select("id, nombre, descripcion, alias, fusionado_en")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`No pude leer el tema ${id}: ${error.message}`, { cause: error })
  if (!tema || tema.fusionado_en !== null) return null

  const filas = await leerTodas(`las afirmaciones del tema ${id}`, (desde, hasta) =>
    db
      .from("afirmaciones")
      .select(COLUMNAS_DE_AFIRMACION)
      .eq("tema_id", id)
      .eq("excluida", false)
      .order("creada_en")
      .order("id")
      .range(desde, hasta),
  )
  const grupos = new Map<string, TemaLeido["autores"][number]>()
  for (const { autores, autor_id, ubicacion, ...resto } of filas) {
    const grupo = grupos.get(autor_id) ?? {
      autor: { id: autor_id, nombre: autores?.nombre ?? "", credencial: autores?.credencial ?? null },
      afirmaciones: [],
    }
    grupo.afirmaciones.push({ ...resto, ubicacion: ubicacionLeida(ubicacion) })
    grupos.set(autor_id, grupo)
  }
  return {
    tema: { id: tema.id, nombre: tema.nombre, descripcion: tema.descripcion, alias: tema.alias },
    autores: [...grupos.values()].sort(
      (a, b) => b.afirmaciones.length - a.afirmaciones.length || a.autor.nombre.localeCompare(b.autor.nombre, "es"),
    ),
  }
}

const esquemaDeExclusion = z.object({ id: z.string().uuid(), excluida: z.boolean() })

/**
 * Hides or shows a claim with `excluir_afirmacion`. Hiding detaches it from its topic so the next maintenance run
 * recomputes the topic; showing it again leaves it without topic until that run places it.
 */
export async function excluirAfirmacion(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "excluirAfirmacion")
  if (!miembro.ok) return miembro
  const leida = esquemaDeExclusion.safeParse(entrada)
  if (!leida.success) return { ok: false, error: ERROR_SOLICITUD }

  const { error } = await deps.db.rpc("excluir_afirmacion", { p_id: leida.data.id, p_excluida: leida.data.excluida })
  if (error) {
    if (error.code === AFIRMACION_INEXISTENTE) return { ok: false, error: "Esa afirmación ya no existe." }
    console.error(`No pude cambiar la afirmación ${leida.data.id}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  return { ok: true }
}
