import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import { ERROR_SOLICITUD } from "./modelo"
import { type DepsSubir, exigirMiembro } from "./subir"

type Db = SupabaseClient<Database>

export type FilaDelRegistro = Pick<
  Database["public"]["Tables"]["inventario_de_datos"]["Row"],
  | "id"
  | "clave"
  | "dato"
  | "para_que"
  | "proveedor"
  | "pais"
  | "pais_confirmado"
  | "plazo"
  | "regla_de_borrado"
  | "plazo_dias"
  | "orden"
>

const COLUMNAS =
  "id, clave, dato, para_que, proveedor, pais, pais_confirmado, plazo, regla_de_borrado, plazo_dias, orden"
export const SOLO_WAV = "Solo WAV corrige el registro de datos personales. Coni lo revisa en Conidolly."
const FILA_INEXISTENTE = "Esa fila ya no existe. Recarga la página."
const CODIGO_DUPLICADO = "23505"
const CODIGO_DE_CHEQUEO = "23514"
const CODIGO_SIN_PERMISO = "42501"

const texto = (minimo: number, maximo: number, corto: string, largo: string) =>
  z.string().trim().min(minimo, corto).max(maximo, largo)

// The same limits as the checks of `inventario_de_datos` in estudio-coni's migration 20261101000100.
const campos = z.object({
  dato: texto(3, 120, "Escribe el dato en al menos 3 letras.", "El dato es demasiado largo (máximo 120)."),
  para_que: texto(3, 300, "Escribe para qué se usa.", "«Para qué» es demasiado largo (máximo 300)."),
  proveedor: texto(2, 120, "Escribe el proveedor.", "El proveedor es demasiado largo (máximo 120)."),
  pais: texto(2, 80, "Escribe el país, o «Por confirmar».", "El país es demasiado largo (máximo 80)."),
  plazo: texto(3, 200, "Escribe el plazo de borrado en palabras.", "El plazo es demasiado largo (máximo 200)."),
  plazo_dias: z
    .number("Escribe los días como un número.")
    .int("Escribe los días como un número entero.")
    .min(0, "Los días no pueden ser negativos.")
    .max(36500, "Los días no pueden pasar de 36500 (cien años).")
    .nullable(),
  orden: z
    .number("Escribe el orden como un número.")
    .int("Escribe el orden como un número entero.")
    .min(0, "El orden va de 0 a 999.")
    .max(999, "El orden va de 0 a 999."),
})

const filaEditada = campos.extend({ id: z.uuid() })
const filaNueva = campos.extend({
  clave: z
    .string()
    .regex(
      /^[a-z][a-z_]{2,39}$/,
      "La clave va en minúsculas y con guiones bajos, de 3 a 40 letras (por ejemplo, comentarios_de_riesgo).",
    ),
})
const soloElId = z.object({ id: z.uuid() })

/** D2: only WAV corrects the register. Row level security says the same; this answers in words. */
async function exigirWav(db: Db, accion: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const miembro = await exigirMiembro(db, accion)
  if (!miembro.ok) return miembro
  return miembro.rol === "wav" ? { ok: true } : { ok: false, error: SOLO_WAV }
}

function leerEntrada<T extends z.ZodType>(
  esquema: T,
  entrada: unknown,
): { ok: true; datos: z.output<T> } | { ok: false; error: string } {
  const leida = esquema.safeParse(entrada, { error: () => ERROR_SOLICITUD })
  if (!leida.success) return { ok: false, error: leida.error.issues[0]?.message ?? ERROR_SOLICITUD }
  return { ok: true, datos: leida.data }
}

export function falloDeEscritura(
  accion: string,
  error: { code: string; message: string },
): { ok: false; error: string } {
  if (error.code === CODIGO_SIN_PERMISO) return { ok: false, error: SOLO_WAV }
  if (error.code === CODIGO_DUPLICADO) return { ok: false, error: "Ya hay una fila con esa clave." }
  if (error.code === CODIGO_DE_CHEQUEO && error.message.includes("regla_con_plazo")) {
    return { ok: false, error: "Esta fila la borra la app sola: necesita su plazo en días." }
  }
  console.error(`La acción ${accion} no pudo escribir en el registro de datos personales`, error)
  return { ok: false, error: ERROR_GENERICO }
}

/** The register in its order. Row level security shows it to Coni and WAV only. */
export async function listarRegistro(db: Db): Promise<FilaDelRegistro[]> {
  const { data, error } = await db.from("inventario_de_datos").select(COLUMNAS).order("orden")
  if (error) throw new Error(`No pude leer el registro de datos personales: ${error.message}`, { cause: error })
  return data
}

/**
 * Corrects a row. The deletion rule is not among the fields: only a migration sets it (D4). A new country is
 * unconfirmed again until WAV confirms it.
 */
export async function guardarFila(deps: Pick<DepsSubir, "db">, entrada: unknown): Promise<Resultado> {
  const wav = await exigirWav(deps.db, "guardarFila")
  if (!wav.ok) return wav
  const leida = leerEntrada(filaEditada, entrada)
  if (!leida.ok) return leida
  const { id, ...cambios } = leida.datos
  const actual = await deps.db.from("inventario_de_datos").select("pais").eq("id", id).maybeSingle()
  if (actual.error) return falloDeEscritura("guardarFila", actual.error)
  if (!actual.data) return { ok: false, error: FILA_INEXISTENTE }
  const fila = actual.data.pais === cambios.pais ? cambios : { ...cambios, pais_confirmado: false }
  const { data, error } = await deps.db.from("inventario_de_datos").update(fila).eq("id", id).select("id")
  if (error) return falloDeEscritura("guardarFila", error)
  // The row was readable a moment ago, so an update that touches nothing was refused by row level security.
  return data.length === 0 ? { ok: false, error: SOLO_WAV } : { ok: true }
}

/** Adds a kind of data the app started to handle (changes 8, 13 and 27 bring theirs). */
export async function agregarFila(deps: Pick<DepsSubir, "db">, entrada: unknown): Promise<Resultado<{ id: string }>> {
  const wav = await exigirWav(deps.db, "agregarFila")
  if (!wav.ok) return wav
  const leida = leerEntrada(filaNueva, entrada)
  if (!leida.ok) return leida
  const { data, error } = await deps.db.from("inventario_de_datos").insert(leida.datos).select("id").single()
  if (error) return falloDeEscritura("agregarFila", error)
  return { ok: true, id: data.id }
}

/** After the legal review: the country of a row is the real one. */
export async function confirmarPais(deps: Pick<DepsSubir, "db">, entrada: unknown): Promise<Resultado> {
  const wav = await exigirWav(deps.db, "confirmarPais")
  if (!wav.ok) return wav
  const leida = leerEntrada(soloElId, entrada)
  if (!leida.ok) return leida
  const { data, error } = await deps.db
    .from("inventario_de_datos")
    .update({ pais_confirmado: true })
    .eq("id", leida.datos.id)
    .select("id")
  if (error) return falloDeEscritura("confirmarPais", error)
  return data.length === 0 ? { ok: false, error: FILA_INEXISTENTE } : { ok: true }
}
