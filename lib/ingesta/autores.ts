import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import type { AutorDeLista } from "./buscar-autor"
import { Ubicacion } from "./ficha"
import { ERROR_SOLICITUD } from "./modelo"
import { leerTodas } from "./paginas"
import { type DepsSubir, exigirMiembro } from "./subir"

type Db = SupabaseClient<Database>

const esquemaDeAutorNuevo = z.object({
  nombre: z.string().max(200, "Ese nombre es demasiado largo."),
  credencial: z.string().max(200, "Esa credencial es demasiado larga.").optional(),
  tipo: z.enum(["persona", "cuenta", "institucion"], "Elige si es una persona, una cuenta o una institución."),
})

const COLUMNAS = "id, nombre, credencial, tipo, alias"
const CODIGO_INEXISTENTE = "P0002"
const CODIGO_REGLA_DE_NEGOCIO = "22023"
const AUTOR_INEXISTENTE = "Ese autor ya no existe."

/** `jsonb` that is not the shape the database writes is read as empty rather than breaking the whole page. */
const ubicacionLeida = (valor: unknown): Ubicacion | null => {
  const leida = Ubicacion.safeParse(valor)
  return leida.success ? leida.data : null
}

/** The authors in alphabetical order. Row level security shows nothing to someone who is not Coni or WAV. */
export async function listarAutores(db: Db): Promise<AutorDeLista[]> {
  const { data, error } = await db.from("autores").select(COLUMNAS)
  if (error) throw new Error(`No pude leer los autores: ${error.message}`, { cause: error })
  return data.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

/**
 * Adds an author through `crear_autor`, which answers the existing one when the name or an alias was already taken.
 * Coni herself is created by the seed, so `coni` is not a type a person can pick.
 */
export async function crearAutor(
  deps: Pick<DepsSubir, "db">,
  entrada: unknown,
): Promise<Resultado<{ autor: AutorDeLista }>> {
  const miembro = await exigirMiembro(deps.db, "crearAutor")
  if (!miembro.ok) return miembro
  const leida = esquemaDeAutorNuevo.safeParse(entrada, { error: () => ERROR_SOLICITUD })
  if (!leida.success) return { ok: false, error: leida.error.issues[0]?.message ?? ERROR_SOLICITUD }
  const nombre = leida.data.nombre.trim()
  if (nombre === "") return { ok: false, error: "Escribe el nombre del autor." }

  const { data: id, error } = await deps.db.rpc("crear_autor", {
    p_nombre: nombre,
    p_credencial: leida.data.credencial?.trim() ?? "",
    p_tipo: leida.data.tipo,
  })
  if (error) {
    if (error.code === CODIGO_REGLA_DE_NEGOCIO && error.message === "tipo_coni_reservado") {
      return { ok: false, error: "La autora Coni ya existe y no se puede crear otra." }
    }
    console.error("No pude crear el autor", error)
    return { ok: false, error: ERROR_GENERICO }
  }
  const { data: autor, error: errorDeLectura } = await deps.db.from("autores").select(COLUMNAS).eq("id", id).single()
  if (errorDeLectura) {
    console.error("No pude leer el autor que creé", errorDeLectura)
    return { ok: false, error: ERROR_GENERICO }
  }
  return { ok: true, autor }
}

export interface AutorResumido extends AutorDeLista {
  materiales: number
  afirmaciones: number
  /** The three topics where it has most claims. */
  temas: { id: string; nombre: string; afirmaciones: number }[]
}

const TEMAS_POR_AUTOR = 3

/** The authors with how much each has given: materials, visible claims and the topics it speaks of most. */
export async function resumirAutores(db: Db): Promise<AutorResumido[]> {
  const [autores, materiales, afirmaciones] = await Promise.all([
    listarAutores(db),
    leerTodas("los materiales de los autores", (desde, hasta) =>
      db.from("materiales").select("autor_id").order("id").range(desde, hasta),
    ),
    leerTodas("las afirmaciones de los autores", (desde, hasta) =>
      db
        .from("afirmaciones")
        .select("autor_id, tema_id, temas ( nombre )")
        .eq("excluida", false)
        .order("id")
        .range(desde, hasta),
    ),
  ])
  const materialesPorAutor = new Map<string, number>()
  for (const { autor_id } of materiales) materialesPorAutor.set(autor_id, (materialesPorAutor.get(autor_id) ?? 0) + 1)
  const porAutor = new Map<
    string,
    { total: number; temas: Map<string, { id: string; nombre: string; afirmaciones: number }> }
  >()
  for (const fila of afirmaciones) {
    const delAutor = porAutor.get(fila.autor_id) ?? { total: 0, temas: new Map() }
    delAutor.total += 1
    if (fila.tema_id) {
      const tema = delAutor.temas.get(fila.tema_id) ?? {
        id: fila.tema_id,
        nombre: fila.temas?.nombre ?? "",
        afirmaciones: 0,
      }
      tema.afirmaciones += 1
      delAutor.temas.set(fila.tema_id, tema)
    }
    porAutor.set(fila.autor_id, delAutor)
  }
  return autores.map((autor) => ({
    ...autor,
    materiales: materialesPorAutor.get(autor.id) ?? 0,
    afirmaciones: porAutor.get(autor.id)?.total ?? 0,
    temas: [...(porAutor.get(autor.id)?.temas.values() ?? [])]
      .sort((a, b) => b.afirmaciones - a.afirmaciones || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, TEMAS_POR_AUTOR),
  }))
}

export interface AfirmacionDeAutor {
  id: string
  texto: string
  cita: string
  ubicacion: Ubicacion | null
  tipo: string
  evidencia: string
}

export interface AutorLeido {
  autor: AutorDeLista
  materiales: number
  /** Its visible claims by topic, the topic with most claims first; the ones without topic come last. */
  grupos: { tema: { id: string; nombre: string } | null; afirmaciones: AfirmacionDeAutor[] }[]
  /** The ones Coni or WAV hid: this is where they can be shown again. */
  ocultas: AfirmacionDeAutor[]
}

/** One author with its claims grouped by topic; null when it does not exist or is not hers to see. */
export async function leerAutor(db: Db, id: string): Promise<AutorLeido | null> {
  const { data: autor, error } = await db.from("autores").select(COLUMNAS).eq("id", id).maybeSingle()
  if (error) throw new Error(`No pude leer el autor ${id}: ${error.message}`, { cause: error })
  if (!autor) return null

  const { count, error: errorDeConteo } = await db
    .from("materiales")
    .select("id", { count: "exact", head: true })
    .eq("autor_id", id)
  if (errorDeConteo)
    throw new Error(`No pude contar los materiales del autor ${id}: ${errorDeConteo.message}`, { cause: errorDeConteo })

  const filas = await leerTodas(`las afirmaciones del autor ${id}`, (desde, hasta) =>
    db
      .from("afirmaciones")
      .select("id, texto, cita, ubicacion, tipo, evidencia, excluida, tema_id, temas ( nombre )")
      .eq("autor_id", id)
      .order("creada_en")
      .order("id")
      .range(desde, hasta),
  )
  const grupos = new Map<string | null, AutorLeido["grupos"][number]>()
  const ocultas: AfirmacionDeAutor[] = []
  for (const { excluida, tema_id, temas, ubicacion, ...resto } of filas) {
    const afirmacion = { ...resto, ubicacion: ubicacionLeida(ubicacion) }
    if (excluida) {
      ocultas.push(afirmacion)
      continue
    }
    const grupo = grupos.get(tema_id) ?? {
      tema: tema_id ? { id: tema_id, nombre: temas?.nombre ?? "" } : null,
      afirmaciones: [],
    }
    grupo.afirmaciones.push(afirmacion)
    grupos.set(tema_id, grupo)
  }
  return {
    autor,
    materiales: count ?? 0,
    grupos: [...grupos.values()].sort(
      (a, b) =>
        Number(a.tema === null) - Number(b.tema === null) ||
        b.afirmaciones.length - a.afirmaciones.length ||
        (a.tema?.nombre ?? "").localeCompare(b.tema?.nombre ?? "", "es"),
    ),
    ocultas,
  }
}

const esquemaDeFusion = z.object({ origen: z.string().uuid(), destino: z.string().uuid() })

/**
 * Joins one author into another with `fusionar_autores`: its materials and claims pass to the destination and the
 * origin disappears, so Coni herself can never be the origin.
 */
export async function fusionarAutores(deps: Pick<DepsSubir, "db">, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "fusionarAutores")
  if (!miembro.ok) return miembro
  const leida = esquemaDeFusion.safeParse(entrada)
  if (!leida.success) return { ok: false, error: ERROR_SOLICITUD }
  const { origen, destino } = leida.data
  if (origen === destino) return { ok: false, error: "Elige otro autor para unirlos." }

  const { data: delOrigen, error: errorDeLectura } = await deps.db
    .from("autores")
    .select("tipo")
    .eq("id", origen)
    .maybeSingle()
  if (errorDeLectura) {
    console.error(`No pude leer el autor ${origen} antes de unirlo`, errorDeLectura)
    return { ok: false, error: ERROR_GENERICO }
  }
  if (!delOrigen) return { ok: false, error: AUTOR_INEXISTENTE }
  if (delOrigen.tipo === "coni") return { ok: false, error: "Coni no se puede unir a otro autor." }

  const { error } = await deps.db.rpc("fusionar_autores", { p_origen: origen, p_destino: destino })
  if (error) {
    if (error.code === CODIGO_INEXISTENTE) return { ok: false, error: AUTOR_INEXISTENTE }
    console.error(`No pude unir el autor ${origen} con ${destino}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  return { ok: true }
}

const esquemaDeBorrado = z.object({ id: z.string().uuid() })

const MOTIVOS_DE_BORRADO: Record<string, string> = {
  autor_coni_protegido: "La autora Coni no se puede borrar.",
  autor_con_materiales: "No se puede borrar: este autor tiene materiales.",
}

/** Deletes an author with `borrar_autor`, which refuses Coni herself and any author that still has materials. */
export async function borrarAutor(deps: Pick<DepsSubir, "db">, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "borrarAutor")
  if (!miembro.ok) return miembro
  const leida = esquemaDeBorrado.safeParse(entrada)
  if (!leida.success) return { ok: false, error: ERROR_SOLICITUD }

  const { error } = await deps.db.rpc("borrar_autor", { p_id: leida.data.id })
  if (error) {
    if (error.code === CODIGO_INEXISTENTE) return { ok: false, error: AUTOR_INEXISTENTE }
    const motivo = error.code === CODIGO_REGLA_DE_NEGOCIO ? MOTIVOS_DE_BORRADO[error.message] : undefined
    if (motivo) return { ok: false, error: motivo }
    console.error(`No pude borrar el autor ${leida.data.id}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  return { ok: true }
}
