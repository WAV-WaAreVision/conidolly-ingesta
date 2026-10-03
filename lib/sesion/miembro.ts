import type { SupabaseClient } from "@supabase/supabase-js"
import { cache } from "react"
import type { Rol } from "@/lib/acciones/ingreso"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."

/** Coni, the maintainer (WAV) or nobody: the access rules are the rows of `miembros`, not "any signed-in user". */
export function rolDeMiembro(entrada: { esConi: boolean; esMantenedor: boolean }): Rol | null {
  if (entrada.esConi) return "coni"
  return entrada.esMantenedor ? "wav" : null
}

/** Asks the database who the signed-in user is; the same two functions the row level security uses. */
export async function consultarRol(db: SupabaseClient<Database>): Promise<Rol | null> {
  const [coni, mantenedor] = await Promise.all([db.rpc("es_coni"), db.rpc("es_mantenedor")])
  const fallo = coni.error ?? mantenedor.error
  if (fallo) throw new Error(`No pude comprobar quién entró: ${fallo.message}`, { cause: fallo })
  return rolDeMiembro({ esConi: coni.data === true, esMantenedor: mantenedor.data === true })
}

export type SesionLeida =
  | { estado: "miembro"; rol: Rol; db: SupabaseClient<Database>; userId: string }
  | { estado: "sin_sesion" }
  | { estado: "otra_persona" }

/** Who is looking: nobody, someone who is neither Coni nor WAV, or one of the two. Once per request. */
export const leerSesion = cache(async (): Promise<SesionLeida> => {
  const db = await createClient()
  const { data } = await db.auth.getUser()
  if (!data.user) return { estado: "sin_sesion" }
  const rol = await consultarRol(db)
  return rol ? { estado: "miembro", rol, db, userId: data.user.id } : { estado: "otra_persona" }
})
