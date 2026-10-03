import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import type { BrowserContext, Page } from "@playwright/test"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  ARCHIVO_DE_DISPAROS,
  BALDE_DE_PRUEBA,
  BUZON,
  CARPETA_DE_CAPTURAS,
  CLAVE_ANONIMA,
  CLAVE_DE_SERVICIO,
  CORREO_DE_CONI,
  PREFIJO_DE_PRUEBA,
  SUPABASE_URL,
  URL_DE_LA_APP,
  URL_DEL_ALMACEN,
} from "./entorno"

const Mensajes = z.object({
  messages: z.array(z.object({ To: z.array(z.object({ Address: z.string() })), Snippet: z.string() })),
})

export async function vaciarBuzon(): Promise<void> {
  const respuesta = await fetch(`${BUZON}/api/v1/messages`, { method: "DELETE" })
  if (!respuesta.ok) throw new Error(`No pude vaciar el buzón local: ${respuesta.status}`)
}

/** The six digits of the newest email sent to `correo`, read from the local mail catcher (never a real mailbox). */
export async function leerCodigo(correo: string): Promise<string> {
  for (let intento = 0; intento < 30; intento++) {
    const respuesta = await fetch(`${BUZON}/api/v1/messages`)
    const { messages } = Mensajes.parse(await respuesta.json())
    const mensaje = messages.find((candidato) => candidato.To.some((para) => para.Address === correo))
    const codigo = /\b(\d{6})\b/.exec(mensaje?.Snippet ?? "")?.[1]
    if (codigo) return codigo
    await new Promise((resolver) => setTimeout(resolver, 500))
  }
  throw new Error(`No llegó ningún código a ${correo} al buzón local.`)
}

const DisparoDeMaterial = z.object({ tarea: z.literal("procesar-material"), materialId: z.string() })
const DisparoDeTeoria = z.object({
  tarea: z.literal("sintetizar-teoria"),
  teoriaId: z.string(),
  intento: z.string().optional(),
})
const Disparo = z.discriminatedUnion("tarea", [DisparoDeMaterial, DisparoDeTeoria])

export function limpiarDisparos(): void {
  mkdirSync(dirname(ARCHIVO_DE_DISPAROS), { recursive: true })
  rmSync(ARCHIVO_DE_DISPAROS, { force: true })
}

function leerDisparos(): z.infer<typeof Disparo>[] {
  if (!existsSync(ARCHIVO_DE_DISPAROS)) return []
  return readFileSync(ARCHIVO_DE_DISPAROS, "utf-8")
    .split("\n")
    .filter((linea) => linea.trim() !== "")
    .map((linea) => Disparo.parse(JSON.parse(linea)))
}

/** The material runs the app would have started (Trigger.dev is never called in tests). */
export function disparosRegistrados(): z.infer<typeof DisparoDeMaterial>[] {
  return leerDisparos().filter((disparo) => disparo.tarea === "procesar-material")
}

/** The theory syntheses the app would have started. */
export function disparosDeTeoria(): z.infer<typeof DisparoDeTeoria>[] {
  return leerDisparos().filter((disparo) => disparo.tarea === "sintetizar-teoria")
}

const Objetos = z.record(z.string(), z.object({ bytes: z.number(), tipo: z.string(), firmada: z.boolean() }))

/** What the fake R2 received: the path of each object with its size and content type. */
export async function objetosDelAlmacen() {
  return Objetos.parse(await (await fetch(`${URL_DEL_ALMACEN}/__objetos`)).json())
}

/** Puts a file in the fake store, as the background task does when it writes the text of a material. */
export async function ponerObjetoEnElAlmacen(clave: string, contenido: string): Promise<void> {
  const respuesta = await fetch(`${URL_DEL_ALMACEN}/${BALDE_DE_PRUEBA}/${clave}`, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: contenido,
  })
  if (!respuesta.ok) throw new Error(`No pude poner ${clave} en el almacén falso: ${respuesta.status}`)
}

export function clienteDeServicio() {
  return createClient(SUPABASE_URL, CLAVE_DE_SERVICIO, { auth: { persistSession: false } })
}

/** An alert with that text. Next adds its own empty `role=alert` (the route announcer), so a bare role matches two. */
export function alerta(page: Page, texto: string) {
  return page.getByRole("alert").filter({ hasText: texto })
}

export async function capturar(
  page: Page,
  nombre: string,
  carpeta: string = CARPETA_DE_CAPTURAS,
  opciones: { completa?: boolean } = {},
): Promise<string> {
  mkdirSync(carpeta, { recursive: true })
  const ruta = join(carpeta, `${nombre}.png`)
  await page.screenshot({ path: ruta, fullPage: opciones.completa ?? false })
  return ruta
}

/** Signs a seed user in through the real Auth API and gives the browser the cookies the app itself would have set. */
export async function entrarComo(context: BrowserContext, correo: string): Promise<void> {
  const enlace = await clienteDeServicio().auth.admin.generateLink({ type: "magiclink", email: correo })
  if (enlace.error) throw new Error(`No pude generar el código de ${correo}: ${enlace.error.message}`)
  const galletas = new Map<string, string>()
  const cliente = createServerClient(SUPABASE_URL, CLAVE_ANONIMA, {
    cookies: {
      getAll: () => [...galletas].map(([name, value]) => ({ name, value })),
      setAll: (nuevas) => {
        for (const { name, value } of nuevas) galletas.set(name, value)
      },
    },
  })
  const sesion = await cliente.auth.verifyOtp({ email: correo, token: enlace.data.properties.email_otp, type: "email" })
  if (sesion.error) throw new Error(`No pude entrar como ${correo}: ${sesion.error.message}`)
  await context.clearCookies()
  await context.addCookies([...galletas].map(([name, value]) => ({ name, value, url: URL_DE_LA_APP })))
}

/** A real, tiny PDF: the bytes are what the fake store counts. */
export const PDF_MINIMO = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
)

/** A 1x1 PNG. */
export const PNG_MINIMO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

export async function idDeConi(): Promise<string> {
  const { data, error } = await clienteDeServicio().auth.admin.listUsers()
  const id = data?.users.find((usuario) => usuario.email === CORREO_DE_CONI)?.id
  if (error || !id) throw new Error(`No encontré a ${CORREO_DE_CONI} en el Auth local.`)
  return id
}

/** A ready material with its card, written with the service role: nothing is processed for real. */
export async function sembrarMaterial(titulo: string, autor: string): Promise<string> {
  const servicio = clienteDeServicio()
  const id = randomUUID()
  const categoria = await servicio.from("categorias").select("id").eq("slug", "general").single()
  if (categoria.error) throw new Error(categoria.error.message)
  const material = await servicio.from("materiales").insert({
    id,
    tipo: "documento",
    titulo: `${PREFIJO_DE_PRUEBA}${titulo}`,
    autor,
    categoria_id: categoria.data.id,
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: await idDeConi(),
    estado: "listo",
    idioma_original: "es",
  })
  if (material.error) throw new Error(material.error.message)
  const ficha = await servicio.from("fichas").insert({
    material_id: id,
    resumen: "Un resumen de prueba.",
    ideas_clave: ["uno", "dos", "tres", "cuatro", "cinco"],
    citas: [{ texto: "Una cita de prueba.", ubicacion: { pagina: 3 } }],
    fuente: { autor, anio: 2020, enlace: null },
  })
  if (ficha.error) throw new Error(ficha.error.message)
  return id
}
