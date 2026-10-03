import { existsSync } from "node:fs"
import { join } from "node:path"

// The keys of the local Supabase live in .env.local (gitignored); Node reads it without any extra package.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

function exigir(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) throw new Error(`Falta ${nombre}: copia las claves del Supabase local a .env.local (ver .env.example).`)
  return valor
}

export const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421"
// The run signs users in and deletes rows: it only ever talks to the Supabase of this machine.
if (!["127.0.0.1", "localhost"].includes(new URL(SUPABASE_URL).hostname)) {
  throw new Error(`El E2E solo corre contra el Supabase local, no contra ${SUPABASE_URL}.`)
}

export const CLAVE_ANONIMA = exigir("NEXT_PUBLIC_SUPABASE_ANON_KEY")
export const CLAVE_DE_SERVICIO = exigir("SUPABASE_SERVICE_ROLE_KEY")
export const BUZON = process.env.MAILPIT_URL ?? "http://127.0.0.1:54424"

// E2E_PUERTO lets a second checkout run its own app next to another one.
export const PUERTO = Number(process.env.E2E_PUERTO ?? 3100)
export const URL_DE_LA_APP = `http://127.0.0.1:${PUERTO}`
export const CORREO_DE_CONI = "coni@estudio.test"
export const CORREO_DE_WAV = "wav@estudio.test"
export const CORREO_DE_OTRA_PERSONA = "otra@estudio.test"

/** The fake S3 of the run: the signed URLs of the app point at it instead of R2. */
export const PUERTO_DEL_ALMACEN = Number(process.env.E2E_PUERTO_ALMACEN ?? 3101)
export const URL_DEL_ALMACEN = `http://127.0.0.1:${PUERTO_DEL_ALMACEN}`
export const BALDE_DE_PRUEBA = "material-de-prueba"

/** Where the app writes the runs it would have started: the test reads it instead of calling Trigger.dev. */
export const ARCHIVO_DE_DISPAROS = join(process.cwd(), "test-results", "disparos.jsonl")
export const CARPETA_DE_CAPTURAS = join(process.cwd(), "test-results", "capturas")
export const CARPETA_DE_DOCUMENTACION = join(process.cwd(), "docs", "capturas")
export const ESTADO_DE_SESION = join(process.cwd(), "tests", "e2e", ".auth", "coni.json")
export const PREFIJO_DE_PRUEBA = "E2E "
