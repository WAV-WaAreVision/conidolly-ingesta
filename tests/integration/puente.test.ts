import { createServerClient } from "@supabase/ssr"
import { describe, expect, it } from "vitest"
import { claveDeSesion, cruzarPuente, DESTINO_DEL_PUENTE_VENCIDO } from "@/lib/sesion/puente"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeServicio } from "./sesion"

const CORREO_DE_CONI = "coni@estudio.test"

function variable(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) throw new Error(`Falta ${nombre}: copia las claves del Supabase local a .env.local (ver .env.example).`)
  return valor
}

/** A browser of its own: the cookies the server client writes, kept in memory. */
function navegador() {
  const galletas = new Map<string, string>()
  const cliente = createServerClient<Database>(variable("SUPABASE_URL"), variable("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => [...galletas].map(([name, value]) => ({ name, value })),
      setAll: (nuevas) => {
        for (const { name, value } of nuevas) {
          if (value === "") galletas.delete(name)
          else galletas.set(name, value)
        }
      },
    },
  })
  return { cliente, galletas }
}

/** What Conidolly's /ir-a-biblioteca puts in the form: the hashed token of an admin magic link. */
async function tokenDeConi(): Promise<string> {
  const { data, error } = await clienteDeServicio().auth.admin.generateLink({
    type: "magiclink",
    email: CORREO_DE_CONI,
  })
  if (error) throw new Error(`No pude generar el enlace de Coni: ${error.message}`, { cause: error })
  return data.properties.hashed_token
}

describe("the bridge against the local Supabase", () => {
  it("opens Coni's session from a generateLink token, with the session cookie the app reads", async () => {
    const { cliente, galletas } = navegador()

    expect(await cruzarPuente(cliente.auth, await tokenDeConi())).toBe("/")

    const { data } = await cliente.auth.getUser()
    expect(data.user?.email).toBe(CORREO_DE_CONI)
    const clave = claveDeSesion(variable("SUPABASE_URL"))
    expect([...galletas.keys()].some((nombre) => nombre === clave || nombre.startsWith(`${clave}.`))).toBe(true)
    // GoTrue stamps the token with its own clock; PostgREST rejects one "issued at future" in the same second.
    await new Promise((resolver) => setTimeout(resolver, 1100))
    const esConi = await cliente.rpc("es_coni")
    expect(esConi.error).toBeNull()
    expect(esConi.data).toBe(true)
  })

  it("refuses the same token a second time and sends to the expired-link message", async () => {
    const token = await tokenDeConi()
    expect(await cruzarPuente(navegador().cliente.auth, token)).toBe("/")

    const segundo = navegador()
    expect(await cruzarPuente(segundo.cliente.auth, token)).toBe(DESTINO_DEL_PUENTE_VENCIDO)
    const { data } = await segundo.cliente.auth.getUser()
    expect(data.user).toBeNull()
  })
})
