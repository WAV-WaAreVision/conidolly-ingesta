import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import { TIPOS_DE_VINCULO, type VinculoDelGrafo } from "./grafo"
import { ERROR_SOLICITUD } from "./modelo"
import { type DepsSubir, exigirMiembro } from "./subir"

type Db = SupabaseClient<Database>

const CODIGO_INVALIDO = "22023"
const CODIGO_INEXISTENTE = "P0002"
const VINCULO_INEXISTENTE = "Ese vínculo ya no existe."
const VINCULO_DESCARTADO = "Ese vínculo ya está descartado."
const VINCULO_EXISTENTE = "Ese vínculo ya existe."
const MAXIMO_DE_VINCULOS = 2000

const id = z.string().uuid()
const relevancia = z.number().int().min(1).max(5)
const par = z.object({ materialA: id, materialB: id }).refine((p) => p.materialA !== p.materialB)
const esquemaDeRelevancia = z
  .object({ materialA: id, materialB: id, relevancia })
  .refine((p) => p.materialA !== p.materialB)
const esquemaDeCreacion = z
  .object({
    materialA: id,
    materialB: id,
    tipo: z.enum(TIPOS_DE_VINCULO),
    relevancia,
    razon: z.string().trim().max(500).optional(),
  })
  .refine((p) => p.materialA !== p.materialB)

/** The pair in the order the table stores it, so the caller never has to care about which side is which. */
const ordenado = (a: string, b: string): { p_a: string; p_b: string } =>
  a < b ? { p_a: a, p_b: b } : { p_a: b, p_b: a }

/** The links that are not discarded (row level security lets Coni and WAV read them), strongest first. */
export async function listarVinculos(db: Db): Promise<VinculoDelGrafo[]> {
  const { data, error } = await db
    .from("vinculos")
    .select("material_a, material_b, tipo, relevancia, estado, razon, cita_a, cita_b")
    .neq("estado", "descartado")
    .order("relevancia", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(MAXIMO_DE_VINCULOS)
  if (error) throw new Error(`No pude leer los vínculos: ${error.message}`, { cause: error })
  return data
}

function fallaDeVinculo(accion: string, error: { code?: string; message: string }): Resultado {
  if (error.code === CODIGO_INEXISTENTE) return { ok: false, error: VINCULO_INEXISTENTE }
  if (error.code === CODIGO_INVALIDO) {
    if (error.message === "vinculo_descartado") return { ok: false, error: VINCULO_DESCARTADO }
    if (error.message === "vinculo_existente") return { ok: false, error: VINCULO_EXISTENTE }
    return { ok: false, error: ERROR_SOLICITUD }
  }
  console.error(`La acción ${accion} falló`, error)
  return { ok: false, error: ERROR_GENERICO }
}

export async function aceptarVinculo(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "aceptarVinculo")
  if (!miembro.ok) return miembro
  const leido = par.safeParse(entrada)
  if (!leido.success) return { ok: false, error: ERROR_SOLICITUD }
  const { error } = await deps.db.rpc("aceptar_vinculo", ordenado(leido.data.materialA, leido.data.materialB))
  return error ? fallaDeVinculo("aceptarVinculo", error) : { ok: true }
}

export async function descartarVinculo(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "descartarVinculo")
  if (!miembro.ok) return miembro
  const leido = par.safeParse(entrada)
  if (!leido.success) return { ok: false, error: ERROR_SOLICITUD }
  const { error } = await deps.db.rpc("descartar_vinculo", ordenado(leido.data.materialA, leido.data.materialB))
  return error ? fallaDeVinculo("descartarVinculo", error) : { ok: true }
}

/** Changing the relevance of a link is a decision about it: a suggestion becomes accepted along the way. */
export async function cambiarRelevancia(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "cambiarRelevancia")
  if (!miembro.ok) return miembro
  const leido = esquemaDeRelevancia.safeParse(entrada)
  if (!leido.success) return { ok: false, error: ERROR_SOLICITUD }
  const { error } = await deps.db.rpc("aceptar_vinculo", {
    ...ordenado(leido.data.materialA, leido.data.materialB),
    p_relevancia: leido.data.relevancia,
  })
  return error ? fallaDeVinculo("cambiarRelevancia", error) : { ok: true }
}

/** A link made by hand is born accepted. */
export async function crearVinculo(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "crearVinculo")
  if (!miembro.ok) return miembro
  const leido = esquemaDeCreacion.safeParse(entrada)
  if (!leido.success) return { ok: false, error: ERROR_SOLICITUD }
  const { error } = await deps.db.rpc("crear_vinculo", {
    ...ordenado(leido.data.materialA, leido.data.materialB),
    p_tipo: leido.data.tipo,
    p_relevancia: leido.data.relevancia,
    p_razon: leido.data.razon ?? "",
  })
  return error ? fallaDeVinculo("crearVinculo", error) : { ok: true }
}
