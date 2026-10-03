import { randomUUID } from "node:crypto"
import { almacenDeEntorno } from "@/lib/almacen/almacen"
import { dispararProcesarMaterial } from "@/lib/ingesta/disparo"
import type { DepsSubir } from "@/lib/ingesta/subir"
import { createActionClient } from "@/lib/supabase/action"
import { ERROR_GENERICO, ERROR_SESION_VENCIDA, type Resultado } from "./resultado"

/**
 * Runs a Server Action as the signed-in person, with her own client. A Server Action is a public endpoint: the proxy
 * only does the optimistic check, so the session is looked at again here and membership inside `trabajo`.
 */
export async function conSesion<T extends object>(
  nombre: string,
  trabajo: (deps: DepsSubir) => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  let db: Awaited<ReturnType<typeof createActionClient>>
  try {
    db = await createActionClient()
    const { data } = await db.auth.getUser()
    if (!data.user) return { ok: false, error: ERROR_SESION_VENCIDA }
  } catch (error) {
    console.error(`La acción ${nombre} no pudo abrir la sesión`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  return trabajo({
    db,
    // Resolved on use: a missing R2 variable must not stop an action that does not sign or measure a file.
    almacen: {
      urlDeSubida: (clave, segundos, tipo) => almacenDeEntorno().urlDeSubida(clave, segundos, tipo),
      tamano: (clave) => almacenDeEntorno().tamano(clave),
      urlFirmada: (clave, segundos, opciones) => almacenDeEntorno().urlFirmada(clave, segundos, opciones),
      borrarCarpeta: (materialId) => almacenDeEntorno().borrarCarpeta(materialId),
    },
    disparar: (materialId, intento) => dispararProcesarMaterial(materialId, process.env, intento),
    ahora: () => new Date(),
    nuevoId: randomUUID,
  })
}
