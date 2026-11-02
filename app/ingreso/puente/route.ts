import { type CookieOptions, createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { exigirEnv } from "@/lib/env"
import {
  claveDeSesion,
  cruzarPuente,
  DESTINO_DEL_PUENTE_VENCIDO,
  galletasDeLaSesionAnterior,
  origenDeConidolly,
} from "@/lib/sesion/puente"
import { RUTA_DE_INGRESO } from "@/lib/sesion/rutas"

export const dynamic = "force-dynamic"

// The token rode in a POST body: the answer is never cached and never tells the next page where it came from.
const CABECERAS = { "cache-control": "no-store", "referrer-policy": "no-referrer" }

function irA(ruta: string): NextResponse {
  // A relative Location keeps the host the browser is on (no `new URL(..., request.url)`).
  return new NextResponse(null, { status: 303, headers: { location: ruta, ...CABECERAS } })
}

type GalletaNueva = { name: string; value: string; options: CookieOptions }

/** The other end of Conidolly's Biblioteca tab (change 29a): the form there posts Coni's one-time token here. */
export async function POST(request: NextRequest) {
  // A form on any other site could post here too: it must not touch the session of whoever is signed in (spec 2).
  const origen = origenDeConidolly(process.env.CONIDOLLY_URL, process.env.NODE_ENV)
  if (origen === null || request.headers.get("origin") !== origen) return irA(RUTA_DE_INGRESO)

  const urlDeSupabase = exigirEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  const nuevas: GalletaNueva[] = []
  const db = createServerClient(
    urlDeSupabase,
    exigirEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(galletas) {
          nuevas.push(...galletas)
        },
      },
    },
  )

  let formulario: FormData
  try {
    formulario = await request.formData()
  } catch (error) {
    // Only the kind of error: the body may hold a token and never reaches the log.
    console.error("El puente recibió un cuerpo que no es un formulario", error instanceof Error ? error.name : "otro")
    return conSesionNueva(irA(DESTINO_DEL_PUENTE_VENCIDO), urlDeSupabase, nuevas)
  }

  const destino = await cruzarPuente(db.auth, formulario.get("token_hash"))
  return conSesionNueva(irA(destino), urlDeSupabase, nuevas)
}

/** Expires the previous person's session cookies first; the ones Supabase just wrote replace them by name. */
function conSesionNueva(respuesta: NextResponse, urlDeSupabase: string, nuevas: GalletaNueva[]): NextResponse {
  for (const nombre of galletasDeLaSesionAnterior(claveDeSesion(urlDeSupabase))) {
    respuesta.cookies.set(nombre, "", { path: "/", maxAge: 0 })
  }
  for (const { name, value, options } of nuevas) respuesta.cookies.set(name, value, options)
  return respuesta
}

export function GET() {
  return irA(RUTA_DE_INGRESO)
}
