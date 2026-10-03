import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import { type FichaLeida, leerEdicion, leerFicha } from "./ficha"
import type { FiltrosDeMateriales } from "./filtros"
import { ERROR_SOLICITUD, esquemaDeId, ROLES } from "./modelo"
import { type DepsSubir, exigirMiembro, idDelUsuario, marcarDisparoFallido } from "./subir"

type Db = SupabaseClient<Database>

const MAXIMO_DE_MATERIALES = 100
const SEGUNDOS_DE_DESCARGA = 5 * 60
const YA_NO_SE_PUEDE_REINTENTAR = "Ese material ya no se puede reintentar."
const YA_NO_ESPERA_CONFIRMACION = "Ese material ya no espera confirmación."
const SIN_PERMISO_PARA_BORRAR = "Solo Coni o quien lo subió puede borrarlo."
const NO_SE_PUEDE_REPROCESAR = "Ese material no se puede reprocesar ahora."
const NO_ENCONTRE_EL_MATERIAL = "No encontré ese material."
const CODIGO_NO_REINTENTABLE = "22023"
const CLAVE_FORANEA = "23503"
/** PostgREST answers at most this many rows per request (`max_rows`), so a material's claims are read in pages. */
const FILAS_POR_PAGINA = 1000

export interface MaterialDeLista {
  id: string
  titulo: string | null
  autor_id: string
  autor: string
  rol: string
  tipo: string
  estado: string
  motivo_fallo: string | null
  costo_estimado_usd: number | null
  costo_confirmado_en: string | null
}

const COLUMNAS_DE_LISTA =
  "id, titulo, autor_id, rol, tipo, estado, motivo_fallo, costo_estimado_usd, costo_confirmado_en, autores ( nombre )"

/** The materials, newest first, with the name of their author; the filters are the ones of the URL. */
export async function listarMateriales(db: Db, filtros: FiltrosDeMateriales): Promise<MaterialDeLista[]> {
  let consulta = db
    .from("materiales")
    .select(COLUMNAS_DE_LISTA)
    .order("creado_en", { ascending: false })
    .limit(MAXIMO_DE_MATERIALES)
  if (filtros.autor) consulta = consulta.eq("autor_id", filtros.autor)
  if (filtros.rol) consulta = consulta.eq("rol", filtros.rol)
  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo)
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado)
  const { data, error } = await consulta
  if (error) throw new Error(`No pude leer el material: ${error.message}`, { cause: error })
  return data.map(({ autores, ...material }) => ({ ...material, autor: autores?.nombre ?? "" }))
}

export interface MaterialLeido extends MaterialDeLista {
  idioma_original: string | null
  origen_url: string | null
}

/** One material with its author and its card (null while it has none, or when the card cannot be read). */
export async function leerMaterialConFicha(
  db: Db,
  id: string,
): Promise<{ material: MaterialLeido; ficha: FichaLeida | null } | null> {
  const { data, error } = await db
    .from("materiales")
    .select(`${COLUMNAS_DE_LISTA}, idioma_original, origen_url, fichas ( resumen, ideas_clave, citas, fuente )`)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`No pude leer el material ${id}: ${error.message}`, { cause: error })
  if (!data) return null
  const { autores, fichas, ...material } = data
  const fila = Array.isArray(fichas) ? fichas[0] : fichas
  const ficha = fila ? leerFicha(fila) : null
  if (fila && !ficha) console.error(`La ficha del material ${id} no tiene la forma que escribe la tarea`)
  return { material: { ...material, autor: autores?.nombre ?? "" }, ficha }
}

export interface MapaDelMaterial {
  total: number
  /** The topics its claims belong to, the most claims first. */
  temas: { id: string; nombre: string; afirmaciones: number }[]
  sinTema: number
  tipos: Record<string, number>
  evidencia: Record<string, number>
}

export interface FilaDeAfirmacion {
  tema_id: string | null
  tipo: string
  evidencia: string
  temas: { nombre: string } | null
}

const sumar = (cuentas: Record<string, number>, clave: string) => {
  cuentas[clave] = (cuentas[clave] ?? 0) + 1
}

/** Counts the claims of one material by topic, by type and by kind of evidence. */
export function armarMapa(filas: FilaDeAfirmacion[]): MapaDelMaterial {
  const temas = new Map<string, { id: string; nombre: string; afirmaciones: number }>()
  const mapa: MapaDelMaterial = { total: filas.length, temas: [], sinTema: 0, tipos: {}, evidencia: {} }
  for (const fila of filas) {
    sumar(mapa.tipos, fila.tipo)
    sumar(mapa.evidencia, fila.evidencia)
    if (fila.tema_id === null) {
      mapa.sinTema += 1
      continue
    }
    const tema = temas.get(fila.tema_id) ?? { id: fila.tema_id, nombre: fila.temas?.nombre ?? "", afirmaciones: 0 }
    tema.afirmaciones += 1
    temas.set(fila.tema_id, tema)
  }
  mapa.temas = [...temas.values()].sort(
    (a, b) => b.afirmaciones - a.afirmaciones || a.nombre.localeCompare(b.nombre, "es"),
  )
  return mapa
}

/** The map of a material: what its claims are about and how they are backed. Excluded claims are not part of it. */
export async function leerMapaDelMaterial(db: Db, materialId: string): Promise<MapaDelMaterial> {
  const filas: FilaDeAfirmacion[] = []
  for (let desde = 0; ; desde += FILAS_POR_PAGINA) {
    const { data, error } = await db
      .from("afirmaciones")
      .select("tema_id, tipo, evidencia, temas ( nombre )")
      .eq("material_id", materialId)
      .eq("excluida", false)
      .order("id")
      .range(desde, desde + FILAS_POR_PAGINA - 1)
    if (error)
      throw new Error(`No pude leer las afirmaciones del material ${materialId}: ${error.message}`, { cause: error })
    filas.push(...data)
    if (data.length < FILAS_POR_PAGINA) return armarMapa(filas)
  }
}

const esquemaDeEdicion = z.object({
  materialId: z.string().uuid(),
  autorId: z.string().uuid("Elige el autor."),
  rol: z.enum(ROLES, "Elige qué papel cumple este material."),
})

/** Changes who a material is by and what it is for. Row level security and the column grants allow only these two. */
export async function editarMaterial(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "editarMaterial")
  if (!miembro.ok) return miembro
  const leida = esquemaDeEdicion.safeParse(entrada, { error: () => ERROR_SOLICITUD })
  if (!leida.success) return { ok: false, error: leida.error.issues[0]?.message ?? ERROR_SOLICITUD }
  const { materialId, autorId, rol } = leida.data

  const { data, error } = await deps.db
    .from("materiales")
    .update({ autor_id: autorId, rol })
    .eq("id", materialId)
    .select("id")
  if (error) {
    if (error.code === CLAVE_FORANEA) return { ok: false, error: "Ese autor ya no existe. Elígelo de nuevo." }
    console.error(`No pude cambiar el autor y el papel del material ${materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  if (data.length === 0) return { ok: false, error: NO_ENCONTRE_EL_MATERIAL }
  return { ok: true }
}

/**
 * Sends a ready material through the whole process again with `reprocesar_material`, which drops what the old run
 * derived, then starts a new run under an attempt key of its own. The database goes first: it is what refuses a
 * second tap. When the run cannot start the material is left retryable.
 */
export async function reprocesarMaterial(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "reprocesarMaterial")
  if (!miembro.ok) return miembro
  const id = esquemaDeId.safeParse(entrada)
  if (!id.success) return { ok: false, error: ERROR_SOLICITUD }
  const { materialId } = id.data

  const { error } = await deps.db.rpc("reprocesar_material", { p_id: materialId })
  if (error) {
    if (error.code === CODIGO_NO_REINTENTABLE) return { ok: false, error: NO_SE_PUEDE_REPROCESAR }
    console.error(`No pude reprocesar el material ${materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  try {
    await deps.disparar(materialId, deps.nuevoId())
  } catch (errorDeDisparo) {
    console.error(`No pude iniciar el procesamiento del material ${materialId} al reprocesar`, errorDeDisparo)
    await marcarDisparoFallido(deps.db, materialId)
    return { ok: false, error: "No pude iniciar el procesamiento. Toca Reintentar en un rato." }
  }
  return { ok: true }
}

/**
 * Puts a failed material (or one the monthly cap stopped) back to `procesando` through `reintentar_material`, then
 * starts a new run under an attempt key of its own. The database goes first: it is what refuses a second tap.
 */
export async function reintentarMaterial(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "reintentarMaterial")
  if (!miembro.ok) return miembro
  const id = esquemaDeId.safeParse(entrada)
  if (!id.success) return { ok: false, error: ERROR_SOLICITUD }
  const { materialId } = id.data

  const { error } = await deps.db.rpc("reintentar_material", { p_id: materialId })
  if (error) {
    if (error.code === CODIGO_NO_REINTENTABLE) return { ok: false, error: YA_NO_SE_PUEDE_REINTENTAR }
    console.error(`No pude reintentar el material ${materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  try {
    await deps.disparar(materialId, deps.nuevoId())
  } catch (errorDeDisparo) {
    console.error(`No pude iniciar el procesamiento del material ${materialId} al reintentar`, errorDeDisparo)
    await marcarDisparoFallido(deps.db, materialId)
    return {
      ok: false,
      error: "No pude iniciar el procesamiento. Toca Reintentar en un rato.",
    }
  }
  return { ok: true }
}

/**
 * Confirms the cost of a long material through `confirmar_costo_material`, then starts a new run under an attempt key
 * of its own: the task already stored the extraction, so it only spends on what is left. The database goes first: it
 * is what refuses a second tap. When the run cannot start the material is left retryable.
 */
export async function confirmarCosto(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "confirmarCosto")
  if (!miembro.ok) return miembro
  const id = esquemaDeId.safeParse(entrada)
  if (!id.success) return { ok: false, error: ERROR_SOLICITUD }
  const { materialId } = id.data

  const { error } = await deps.db.rpc("confirmar_costo_material", { p_id: materialId })
  if (error) {
    if (error.code === CODIGO_NO_REINTENTABLE) return { ok: false, error: YA_NO_ESPERA_CONFIRMACION }
    console.error(`No pude confirmar el costo del material ${materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  try {
    await deps.disparar(materialId, deps.nuevoId())
  } catch (errorDeDisparo) {
    console.error(`No pude iniciar el procesamiento del material ${materialId} al confirmar el costo`, errorDeDisparo)
    await marcarDisparoFallido(deps.db, materialId)
    return { ok: false, error: "No pude iniciar el procesamiento. Toca Reintentar en un rato." }
  }
  return { ok: true }
}

/** Saves what Coni or WAV changed on a card. Row level security allows it; nothing but the four fields is written. */
export async function editarFicha(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "editarFicha")
  if (!miembro.ok) return miembro
  const leida = leerEdicion(entrada)
  if (!leida.ok) return leida
  const { materialId, resumen, ideasClave, citas, fuente } = leida.datos

  const { data, error } = await deps.db
    .from("fichas")
    .update({ resumen, ideas_clave: ideasClave, citas, fuente })
    .eq("material_id", materialId)
    .select("material_id")
  if (error) {
    console.error(`No pude guardar la ficha del material ${materialId}`, error)
    return { ok: false, error: "No pude guardar los cambios. Inténtalo de nuevo." }
  }
  if (data.length === 0) return { ok: false, error: "Ese material todavía no tiene ficha." }
  return { ok: true }
}

/**
 * Deletes a material: Coni any, WAV only its own. Row level security enforces it; the check here gives the reason.
 * Its stored files go after the row. If that fails the material is already gone, so the person is told it worked and
 * the leftover objects are logged by prefix for the sweep.
 */
export async function borrarMaterial(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "borrarMaterial")
  if (!miembro.ok) return miembro
  const id = esquemaDeId.safeParse(entrada)
  if (!id.success) return { ok: false, error: ERROR_SOLICITUD }
  const { materialId } = id.data
  const userId = await idDelUsuario(deps.db)
  if (!userId) return { ok: false, error: ERROR_GENERICO }

  const { data: material, error: errorDeLectura } = await deps.db
    .from("materiales")
    .select("subido_por")
    .eq("id", materialId)
    .maybeSingle()
  if (errorDeLectura) {
    console.error(`No pude leer el material ${materialId}`, errorDeLectura)
    return { ok: false, error: ERROR_GENERICO }
  }
  if (!material) return { ok: false, error: "No encontré ese material." }
  if (miembro.rol !== "coni" && material.subido_por !== userId) return { ok: false, error: SIN_PERMISO_PARA_BORRAR }

  const { data: borrados, error } = await deps.db.from("materiales").delete().eq("id", materialId).select("id")
  if (error) {
    console.error(`No pude borrar el material ${materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  if (borrados.length === 0) return { ok: false, error: SIN_PERMISO_PARA_BORRAR }

  try {
    await deps.almacen.borrarCarpeta(materialId)
  } catch (errorDeAlmacen) {
    console.error(
      `El material ${materialId} se borró, pero no pude borrar sus archivos de materiales/${materialId}/: quedan huérfanos hasta el barrido`,
      errorDeAlmacen,
    )
  }
  return { ok: true }
}

const ARCHIVO_DE_TEXTO = "texto-original.txt"

/** A short-lived download link for the original text of a material (the extraction, never a translation). */
export async function urlDeTexto(deps: DepsSubir, entrada: unknown): Promise<Resultado<{ url: string }>> {
  const miembro = await exigirMiembro(deps.db, "urlDeTexto")
  if (!miembro.ok) return miembro
  const leida = esquemaDeId.safeParse(entrada)
  if (!leida.success) return { ok: false, error: ERROR_SOLICITUD }
  const archivo = ARCHIVO_DE_TEXTO
  try {
    const url = await deps.almacen.urlFirmada(`materiales/${leida.data.materialId}/${archivo}`, SEGUNDOS_DE_DESCARGA, {
      descargarComo: archivo,
    })
    return url ? { ok: true, url } : { ok: false, error: "Ese texto todavía no está disponible." }
  } catch (error) {
    console.error(`No pude firmar la descarga de ${archivo} del material ${leida.data.materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
}
