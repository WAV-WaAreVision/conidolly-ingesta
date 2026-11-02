import type { AuthError } from "@supabase/supabase-js"
import { z } from "zod"
import { RUTA_DE_INGRESO } from "./rutas"

type Respuesta = { error: Pick<AuthError, "message" | "status" | "code"> | null }

/** The two calls of Supabase Auth the bridge needs; a test passes a fake. */
export interface AuthDelPuente {
  signOut(args: { scope: "local" }): PromiseLike<Respuesta>
  verifyOtp(args: { token_hash: string; type: "email" }): PromiseLike<Respuesta>
}

export const DESTINO_DEL_PUENTE_VENCIDO = `${RUTA_DE_INGRESO}?puente=vencido`
export const TEXTO_PUENTE_VENCIDO = "El enlace ya se usó o venció. Vuelve a Conidolly y toca Biblioteca otra vez."

// GoTrue's hashed tokens are 56 hex characters today; the bound only keeps a junk body away from Auth.
const TokenDelPuente = z.string().trim().min(1).max(512)

/**
 * Swaps whatever session this browser had for the one the token of Conidolly's Biblioteca tab opens. The token is
 * `hashed_token` of `auth.admin.generateLink({ type: "magiclink" })`, verified as an email token hash (B11, pinned by
 * tests/integration/puente.test.ts). Who may then enter is decided as always by `leerSesion` and `miembros`.
 */
export async function cruzarPuente(auth: AuthDelPuente, token: unknown): Promise<string> {
  const leido = TokenDelPuente.safeParse(token)
  if (!leido.success) return DESTINO_DEL_PUENTE_VENCIDO
  const salida = await auth.signOut({ scope: "local" })
  if (salida.error) {
    console.error("No pude cerrar la sesión anterior antes del puente", {
      status: salida.error.status,
      code: salida.error.code,
    })
  }
  const { error } = await auth.verifyOtp({ token_hash: leido.data, type: "email" })
  if (!error) return "/"
  // 403 is a used, expired or unknown token: a normal case with its own message, nothing for WAV to read.
  if (error.status !== 403) {
    console.error("No pude verificar el enlace de la Biblioteca", { status: error.status, code: error.code })
  }
  return DESTINO_DEL_PUENTE_VENCIDO
}

/** The cookie @supabase/ssr keeps the session in: supabase-js names it after the first label of the project's host. */
export function claveDeSesion(urlDeSupabase: string): string {
  return `sb-${new URL(urlDeSupabase).hostname.split(".")[0]}-auth-token`
}

/**
 * The bridge POST comes from another site, so the browser sends none of the `SameSite=Lax` session cookies and
 * `signOut` cannot see them. These names are expired by hand, the cookie and every chunk, so nothing of the previous
 * person's session survives next to Coni's.
 */
export function galletasDeLaSesionAnterior(clave: string): string[] {
  return [clave, ...Array.from({ length: 5 }, (_, indice) => `${clave}.${indice}`)]
}
