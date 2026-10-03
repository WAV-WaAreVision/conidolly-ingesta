import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import type { AutorDeLista } from "./buscar-autor"
import { ERROR_SOLICITUD } from "./modelo"
import { type DepsSubir, exigirMiembro } from "./subir"

type Db = SupabaseClient<Database>

const esquemaDeAutorNuevo = z.object({
  nombre: z.string().max(200, "Ese nombre es demasiado largo."),
  credencial: z.string().max(200, "Esa credencial es demasiado larga.").optional(),
  tipo: z.enum(["persona", "cuenta", "institucion"], "Elige si es una persona, una cuenta o una institución."),
})

const COLUMNAS = "id, nombre, credencial, tipo, alias"

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
