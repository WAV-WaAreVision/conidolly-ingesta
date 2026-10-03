import type { SupabaseClient } from "@supabase/supabase-js"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import { type Almacen, claveMaterial } from "@/lib/almacen/almacen"
import { consultarRol, SOLO_PARA_MIEMBROS } from "@/lib/sesion/miembro"
import type { Database } from "@/lib/supabase/database.types"
import {
  ERROR_SOLICITUD,
  esquemaDeCategoria,
  esquemaDeId,
  extensionDe,
  leerEntrada,
  TAMANO_MAXIMO_BYTES,
  tipoDeContenido,
} from "./modelo"
import type { SubidaFirmada } from "./subida-cliente"

type Db = SupabaseClient<Database>

export interface DepsSubir {
  /** The client of the signed-in person: row level security is what lets her write, not this code. */
  db: Db
  almacen: Almacen
  disparar: (materialId: string) => Promise<void>
  ahora: () => Date
  nuevoId: () => string
}

const UNA_HORA_S = 60 * 60
const FALTA_EL_ARCHIVO = "No encontré el archivo que subiste. Inténtalo de nuevo."
const PESA_DEMASIADO = "Ese archivo pesa más de 2 GB."
const CLAVE_FORANEA = "23503"

/** Whether the signed-in person is Coni or WAV; a failed check is logged and answered as a plain failure. */
async function exigirMiembro(db: Db, accion: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return (await consultarRol(db)) ? { ok: true } : { ok: false, error: SOLO_PARA_MIEMBROS }
  } catch (error) {
    console.error(`La acción ${accion} no pudo comprobar quién entró`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
}

/** The signed-in person's id; materials are only ever acted on by whoever uploaded them. */
async function idDelUsuario(db: Db): Promise<string | null> {
  const { data, error } = await db.auth.getUser()
  if (error) console.error("No pude leer quién entró", error)
  return data.user?.id ?? null
}

async function borrarMaterial(db: Db, materialId: string): Promise<void> {
  const { error } = await db.from("materiales").delete().eq("id", materialId)
  if (error) console.error(`No pude borrar el material ${materialId}`, error)
}

/**
 * Creates the row of a material and signs the upload of each file. The row is written first, as the signed-in person:
 * nothing is uploaded for a material the database refused.
 */
export async function crearMaterial(
  deps: DepsSubir,
  entrada: unknown,
): Promise<Resultado<{ materialId: string; subidas: SubidaFirmada[] }>> {
  const miembro = await exigirMiembro(deps.db, "crearMaterial")
  if (!miembro.ok) return miembro
  const leida = leerEntrada(entrada)
  if (!leida.ok) return leida
  const { datos } = leida

  const materialId = deps.nuevoId()
  const claves = datos.archivos.map((archivo, indice) =>
    claveMaterial(materialId, extensionDe(archivo.nombre), datos.tipo === "imagen" ? indice + 1 : undefined),
  )

  const { data: material, error } = await deps.db
    .from("materiales")
    .insert({
      id: materialId,
      tipo: datos.tipo,
      titulo: datos.titulo,
      autor: datos.autor,
      categoria_id: datos.categoriaId,
      etiquetas: datos.etiquetas,
      origen_url: datos.url ?? datos.referencia,
      archivo_clave: claves[0] ?? null,
      texto_pegado: datos.textoPegado,
      declaracion_sin_pacientes_en: deps.ahora().toISOString(),
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === CLAVE_FORANEA) return { ok: false, error: "Esa categoría ya no existe. Elige otra." }
    console.error("No pude crear el material", error)
    return { ok: false, error: ERROR_GENERICO }
  }

  if (datos.tipo === "imagen") {
    const { error: errorDeArchivos } = await deps.db
      .from("materiales_archivos")
      .insert(claves.map((clave, indice) => ({ material_id: material.id, orden: indice + 1, archivo_clave: clave })))
    if (errorDeArchivos) {
      console.error("No pude guardar las imágenes del material", errorDeArchivos)
      await borrarMaterial(deps.db, material.id)
      return { ok: false, error: ERROR_GENERICO }
    }
  }

  try {
    const subidas = await Promise.all(
      claves.map(async (clave, indice): Promise<SubidaFirmada> => {
        const tipo = tipoDeContenido(extensionDe(clave))
        return { orden: indice + 1, url: await deps.almacen.urlDeSubida(clave, UNA_HORA_S, tipo), tipoContenido: tipo }
      }),
    )
    return { ok: true, materialId: material.id, subidas }
  } catch (errorDeFirma) {
    console.error("No pude firmar la subida del material", errorDeFirma)
    await borrarMaterial(deps.db, material.id)
    return { ok: false, error: ERROR_GENERICO }
  }
}

/** The keys of the files of a material, in order: the images of `materiales_archivos`, or its single file. */
async function clavesDelMaterial(db: Db, materialId: string, archivoClave: string | null): Promise<string[] | null> {
  const { data, error } = await db
    .from("materiales_archivos")
    .select("orden, archivo_clave")
    .eq("material_id", materialId)
    .order("orden")
  if (error) {
    console.error(`No pude leer los archivos del material ${materialId}`, error)
    return null
  }
  if (data.length > 0) return data.map((archivo) => archivo.archivo_clave)
  return archivoClave ? [archivoClave] : []
}

/** Checks that every file arrived and fits, then starts the processing. A material whose file is wrong is discarded. */
export async function confirmarMaterial(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "confirmarMaterial")
  if (!miembro.ok) return miembro
  const id = esquemaDeId.safeParse(entrada)
  if (!id.success) return { ok: false, error: ERROR_SOLICITUD }
  const { materialId } = id.data
  const userId = await idDelUsuario(deps.db)
  if (!userId) return { ok: false, error: ERROR_GENERICO }

  const { data: material, error } = await deps.db
    .from("materiales")
    .select("id, estado, archivo_clave")
    .eq("id", materialId)
    .eq("subido_por", userId)
    .maybeSingle()
  if (error) {
    console.error(`No pude leer el material ${materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  if (!material) return { ok: false, error: "No encontré ese material." }
  // A second tap, or a retry after the page was closed: the work already started, nothing to do.
  if (material.estado !== "procesando") return { ok: true }

  const claves = await clavesDelMaterial(deps.db, materialId, material.archivo_clave)
  if (!claves) return { ok: false, error: ERROR_GENERICO }

  try {
    for (const clave of claves) {
      const bytes = await deps.almacen.tamano(clave)
      if (bytes === null || bytes === 0 || bytes > TAMANO_MAXIMO_BYTES) {
        await borrarMaterial(deps.db, materialId)
        return { ok: false, error: bytes !== null && bytes > TAMANO_MAXIMO_BYTES ? PESA_DEMASIADO : FALTA_EL_ARCHIVO }
      }
    }
  } catch (errorDeAlmacen) {
    console.error(`No pude revisar los archivos del material ${materialId}`, errorDeAlmacen)
    return { ok: false, error: ERROR_GENERICO }
  }

  try {
    await deps.disparar(materialId)
  } catch (errorDeDisparo) {
    console.error(`No pude iniciar el procesamiento del material ${materialId}`, errorDeDisparo)
    return {
      ok: false,
      error: "El material quedó guardado, pero no pude iniciar su procesamiento. Inténtalo de nuevo en un rato.",
    }
  }
  return { ok: true }
}

/** Throws away a material whose upload failed. Only one that is still `procesando` goes: a ready one is never deleted. */
export async function descartarMaterial(deps: DepsSubir, entrada: unknown): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "descartarMaterial")
  if (!miembro.ok) return miembro
  const id = esquemaDeId.safeParse(entrada)
  if (!id.success) return { ok: false, error: ERROR_SOLICITUD }
  const userId = await idDelUsuario(deps.db)
  if (!userId) return { ok: false, error: ERROR_GENERICO }
  const { error } = await deps.db
    .from("materiales")
    .delete()
    .eq("id", id.data.materialId)
    .eq("subido_por", userId)
    .eq("estado", "procesando")
  if (error) {
    console.error(`No pude descartar el material ${id.data.materialId}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  return { ok: true }
}

export type CategoriaCreada = { id: string; nombre: string }

/** Adds a category through `crear_categoria`, which answers the existing one when the name was already taken. */
export async function crearCategoria(
  deps: Pick<DepsSubir, "db">,
  entrada: unknown,
): Promise<Resultado<{ categoria: CategoriaCreada }>> {
  const miembro = await exigirMiembro(deps.db, "crearCategoria")
  if (!miembro.ok) return miembro
  const datos = esquemaDeCategoria.safeParse(entrada, { error: () => ERROR_SOLICITUD })
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? ERROR_SOLICITUD }
  const nombre = datos.data.nombre.trim()
  if (nombre === "") return { ok: false, error: "Escribe el nombre de la categoría." }

  const { data: id, error } = await deps.db.rpc("crear_categoria", { p_nombre: nombre })
  if (error) {
    console.error("No pude crear la categoría", error)
    return { ok: false, error: ERROR_GENERICO }
  }
  const { data: categoria, error: errorDeLectura } = await deps.db
    .from("categorias")
    .select("id, nombre")
    .eq("id", id)
    .single()
  if (errorDeLectura) {
    console.error("No pude leer la categoría que creé", errorDeLectura)
    return { ok: false, error: ERROR_GENERICO }
  }
  return { ok: true, categoria }
}
