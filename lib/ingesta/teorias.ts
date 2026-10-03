import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import type { TeoriaDelGrafo } from "./grafo"
import { ERROR_SOLICITUD } from "./modelo"
import { AVISO_SIN_SUSTENTO, aTeoriaDelGrafo, aTeoriaLeida, type TeoriaLeida } from "./modelo-de-teoria"
import { MAXIMO_PARA_SINTETIZAR, MINIMO_PARA_SINTETIZAR } from "./seleccion"
import { type DepsSubir, exigirMiembro } from "./subir"

type Db = SupabaseClient<Database>

const CODIGO_INVALIDO = "22023"
const CODIGO_INEXISTENTE = "P0002"
const ERROR_CANTIDAD = `Elige entre ${MINIMO_PARA_SINTETIZAR} y ${MAXIMO_PARA_SINTETIZAR} materiales para armar una teoría.`
const ERROR_NO_LISTOS = "Solo se pueden usar materiales listos y con ficha."
const ERROR_NO_EXISTE = "Esa teoría ya no existe."
const ERROR_NO_REINTENTABLE = "Esa teoría ya no se puede reintentar."
const ERROR_NO_GUARDABLE = "Esa teoría todavía no está lista para guardar."
const ERROR_INCOMPLETA = "Escribe un título y una tesis."
const ERROR_AL_INICIAR = "No pude iniciar la síntesis. Encuéntrala en Teorías y toca Reintentar en un rato."
const MAXIMO_DE_TEORIAS = 200

const id = z.string().uuid()
const esquemaDePedido = z.object({
  materialIds: z
    .array(id)
    .min(MINIMO_PARA_SINTETIZAR)
    .max(MAXIMO_PARA_SINTETIZAR)
    .refine((ids) => new Set(ids).size === ids.length),
})
const esquemaDeId = z.object({ teoriaId: id })
const esquemaDeGuardado = z.object({
  teoriaId: id,
  titulo: z.string().trim().min(1).max(200),
  tesis: z.string().trim().min(1).max(5000),
  categoriaId: id.nullable(),
})

const COLUMNAS =
  "id, titulo, tesis, argumentos, contradicciones, categoria_id, estado, motivo_fallo, motivo_codigo, creada_en, teoria_fuentes ( material_id, materiales ( titulo ) )"

export async function leerTeoria(db: Db, teoriaId: string): Promise<TeoriaLeida | null> {
  const { data, error } = await db.from("teorias").select(COLUMNAS).eq("id", teoriaId).maybeSingle()
  if (error) throw new Error(`No pude leer la teoría ${teoriaId}: ${error.message}`, { cause: error })
  if (!data) return null
  const leida = aTeoriaLeida(data)
  if (!leida) console.error(`La síntesis de la teoría ${teoriaId} no tiene la forma que escribe la tarea`)
  return leida
}

/** The theories, newest first. One that cannot be read is logged and left out rather than breaking the list. */
export async function listarTeorias(db: Db): Promise<TeoriaLeida[]> {
  const { data, error } = await db
    .from("teorias")
    .select(COLUMNAS)
    .order("creada_en", { ascending: false })
    .limit(MAXIMO_DE_TEORIAS)
  if (error) throw new Error(`No pude leer las teorías: ${error.message}`, { cause: error })
  return data.flatMap((fila) => {
    const leida = aTeoriaLeida(fila)
    if (!leida) console.error(`La síntesis de la teoría ${fila.id} no tiene la forma que escribe la tarea`)
    return leida ? [leida] : []
  })
}

/** The saved theories the graph draws, each with the materials it comes from. */
export async function teoriasDelGrafo(db: Db): Promise<TeoriaDelGrafo[]> {
  const { data, error } = await db
    .from("teorias")
    .select("id, titulo, estado, teoria_fuentes ( material_id )")
    .eq("estado", "guardada")
    .order("creada_en", { ascending: false })
    .limit(MAXIMO_DE_TEORIAS)
  if (error) throw new Error(`No pude leer las teorías: ${error.message}`, { cause: error })
  return data.flatMap((fila) => {
    const teoria = aTeoriaDelGrafo({
      id: fila.id,
      titulo: fila.titulo,
      estado: fila.estado,
      fuentes: fila.teoria_fuentes.map((f) => f.material_id),
    })
    return teoria ? [teoria] : []
  })
}

/** The run could not be started: the theory says why, so it stops polling and can be retried. */
async function marcarDisparoFallido(db: Db, teoriaId: string): Promise<void> {
  const { error } = await db.rpc("marcar_teoria_disparo_fallido", { p_id: teoriaId })
  if (error) {
    console.error(`La teoría ${teoriaId} quedó armándose sin motivo: no pude marcar el disparo fallido`, error)
  }
}

/**
 * Creates the theory through `pedir_teoria` (which checks the sources) and starts its synthesis. The database goes
 * first: a theory is never started over sources it refused. When the run cannot start, the theory is left fallida.
 */
export async function pedirTeoria(deps: DepsSubir, entrada: unknown): Promise<Resultado<{ teoriaId: string }>> {
  const miembro = await exigirMiembro(deps.db, "pedirTeoria")
  if (!miembro.ok) return miembro
  const leido = esquemaDePedido.safeParse(entrada)
  if (!leido.success) return { ok: false, error: ERROR_CANTIDAD }

  const { data: teoriaId, error } = await deps.db.rpc("pedir_teoria", { p_materiales: leido.data.materialIds })
  if (error) {
    if (error.code === CODIGO_INVALIDO) return { ok: false, error: ERROR_NO_LISTOS }
    console.error("No pude pedir la teoría", error)
    return { ok: false, error: ERROR_GENERICO }
  }
  try {
    await deps.dispararTeoria(teoriaId)
  } catch (errorDeDisparo) {
    console.error(`No pude iniciar la síntesis de la teoría ${teoriaId}`, errorDeDisparo)
    await marcarDisparoFallido(deps.db, teoriaId)
    return { ok: false, error: ERROR_AL_INICIAR }
  }
  return { ok: true, teoriaId }
}

/**
 * Puts a failed theory back to `sintetizando` through `reintentar_teoria`, then starts a new run under an attempt key
 * of its own. The database goes first: it is what refuses a second tap.
 */
export async function reintentarTeoria(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "reintentarTeoria")
  if (!miembro.ok) return miembro
  const leido = esquemaDeId.safeParse(entrada)
  if (!leido.success) return { ok: false, error: ERROR_SOLICITUD }
  const { teoriaId } = leido.data

  const { error } = await deps.db.rpc("reintentar_teoria", { p_id: teoriaId })
  if (error) {
    if (error.code === CODIGO_INVALIDO) {
      return { ok: false, error: error.message === "teoria_sin_sustento" ? AVISO_SIN_SUSTENTO : ERROR_NO_REINTENTABLE }
    }
    console.error(`No pude reintentar la teoría ${teoriaId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  try {
    await deps.dispararTeoria(teoriaId, deps.nuevoId())
  } catch (errorDeDisparo) {
    console.error(`No pude iniciar la síntesis de la teoría ${teoriaId} al reintentar`, errorDeDisparo)
    await marcarDisparoFallido(deps.db, teoriaId)
    return { ok: false, error: ERROR_AL_INICIAR }
  }
  return { ok: true }
}

/**
 * Saves what Coni or WAV changed: the title, the thesis and the category. The arguments and contradictions are not
 * sent: `guardar_teoria` keeps the ones the task wrote, so no screen, stale or not, can overwrite them.
 */
export async function guardarTeoria(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "guardarTeoria")
  if (!miembro.ok) return miembro
  const leido = esquemaDeGuardado.safeParse(entrada)
  if (!leido.success) return { ok: false, error: ERROR_INCOMPLETA }
  const { teoriaId, titulo, tesis, categoriaId } = leido.data

  const { error } = await deps.db.rpc("guardar_teoria", {
    p_id: teoriaId,
    p_titulo: titulo,
    p_tesis: tesis,
    p_categoria: categoriaId ?? undefined,
  })
  if (error) {
    if (error.code === CODIGO_INEXISTENTE) return { ok: false, error: ERROR_NO_EXISTE }
    if (error.code === CODIGO_INVALIDO) {
      return { ok: false, error: error.message === "teoria_incompleta" ? ERROR_INCOMPLETA : ERROR_NO_GUARDABLE }
    }
    console.error(`No pude guardar la teoría ${teoriaId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  return { ok: true }
}
