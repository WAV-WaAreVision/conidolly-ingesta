import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

function variable(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) throw new Error(`Falta ${nombre}: copia las claves del Supabase local a .env.local (ver .env.example).`)
  return valor
}

const url = () => variable("SUPABASE_URL")

/** A `service_role` client for the fixtures and the cleanup of the tests; the app never uses one. */
export function clienteDeServicio(): SupabaseClient<Database> {
  return createClient<Database>(url(), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * A client signed in as a seed user through the real Auth flow: the admin API mints the emailed code, `verifyOtp`
 * exchanges it for a session, so PostgREST sees the same JWT a browser would send. Row level security applies.
 */
export async function clienteDeUsuario(correo: string): Promise<SupabaseClient<Database>> {
  const { data, error } = await clienteDeServicio().auth.admin.generateLink({ type: "magiclink", email: correo })
  if (error) throw new Error(`No pude generar el código de ${correo}: ${error.message}`, { cause: error })
  const cliente = createClient<Database>(url(), variable("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const sesion = await cliente.auth.verifyOtp({ email: correo, token: data.properties.email_otp, type: "email" })
  if (sesion.error) throw new Error(`No pude entrar como ${correo}: ${sesion.error.message}`, { cause: sesion.error })
  // GoTrue stamps the token with its own clock and PostgREST rejects a token "issued at future" when it checks it in
  // the same second; the local stack's containers disagree by a fraction of a second.
  await new Promise((resolver) => setTimeout(resolver, 1100))
  return cliente
}

export const clienteDeConi = () => clienteDeUsuario("coni@estudio.test")
export const clienteDeWav = () => clienteDeUsuario("wav@estudio.test")
export const clienteDeOtraPersona = () => clienteDeUsuario("otra@estudio.test")
