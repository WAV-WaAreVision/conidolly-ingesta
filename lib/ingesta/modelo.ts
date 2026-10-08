import { z } from "zod"
import { esYoutube } from "./youtube"

export const TIPOS_DE_MATERIAL = ["documento", "link", "audio", "video", "imagen", "post"] as const
export type TipoDeMaterial = (typeof TIPOS_DE_MATERIAL)[number]

export const ROLES = ["voz_propia", "referente", "evidencia", "estrategia"] as const
export type Rol = (typeof ROLES)[number]

export const ETIQUETA_DE_ROL: Record<Rol, string> = {
  voz_propia: "Lo dijo Coni",
  referente: "Referente",
  evidencia: "Estudio o libro",
  estrategia: "Estrategia interna",
}

export const AYUDA_DE_ROL: Record<Rol, string> = {
  voz_propia: "Una charla, audio o texto de ella: sus ideas con sus palabras.",
  referente: "Alguien a quien Coni sigue: sirve para ver cómo lo explica.",
  evidencia: "Un estudio, libro o artículo que respalda con datos lo que se dice.",
  estrategia: "Un plan, una guía o un documento del equipo, no una afirmación sobre el tema.",
}

export const TAMANO_MAXIMO_BYTES = 2 * 1024 ** 3
export const MAXIMO_DE_IMAGENES = 20
const MAXIMO_DE_TEXTO_PEGADO = 200_000

const ERROR_SOLICITUD = "No entendí esa solicitud. Vuelve a abrir la pantalla."

/** What each type accepts as a file, and how the app says it to a person. */
const ARCHIVOS_POR_TIPO: Record<"documento" | "audio" | "video" | "imagen", { extensiones: string[]; ayuda: string }> =
  {
    documento: {
      extensiones: ["pdf", "docx", "txt"],
      ayuda: "Ese archivo no sirve como documento. Sube un PDF, un Word o un texto.",
    },
    audio: { extensiones: ["mp3", "m4a", "wav"], ayuda: "Ese archivo no sirve como audio. Sube un mp3, m4a o wav." },
    video: { extensiones: ["mp4", "mov"], ayuda: "Ese archivo no sirve como video. Sube un mp4 o mov." },
    imagen: {
      extensiones: ["jpg", "jpeg", "png", "webp", "heic"],
      ayuda: "Ese archivo no sirve como imagen. Sube jpg, png, webp o heic.",
    },
  }

const TIPOS_DE_CONTENIDO: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
}

/** The media type the browser must send; it comes from the extension, never from what the browser claims. */
export function tipoDeContenido(extension: string): string {
  return TIPOS_DE_CONTENIDO[extension.toLowerCase()] ?? "application/octet-stream"
}

export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".")
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase()
}

const direccionWeb = z.string().refine((texto) => {
  try {
    const { protocol } = new URL(texto)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}, "Ese link no parece una dirección web válida.")

const textoOpcional = (maximo: number) =>
  z
    .string()
    .max(maximo, "Ese texto es demasiado largo.")
    .optional()
    .transform((texto) => (texto?.trim() ? texto.trim() : null))

const archivoDeclarado = z.object({
  nombre: z.string().min(1).max(255),
  tamano: z.number().int().min(1, "Ese archivo está vacío.").max(TAMANO_MAXIMO_BYTES, "Ese archivo pesa más de 2 GB."),
})

const esquemaBase = z.object({
  tipo: z.enum(TIPOS_DE_MATERIAL, "Elige qué tipo de material es."),
  titulo: textoOpcional(200),
  autorId: z.string().uuid("Elige el autor."),
  rol: z.enum(ROLES, "Elige qué papel cumple este material."),
  declaracion: z.literal(true, "Marca que el material no contiene datos de pacientes."),
  url: z.string().optional(),
  textoPegado: z.string().max(MAXIMO_DE_TEXTO_PEGADO, "Ese texto es demasiado largo.").optional(),
  referencia: z.string().optional(),
  archivos: z.array(archivoDeclarado),
})

function exigirArchivos(
  entrada: z.infer<typeof esquemaBase>,
  contexto: z.RefinementCtx,
  tipoDeArchivo: keyof typeof ARCHIVOS_POR_TIPO,
  cantidad: { minimo: number; maximo: number },
) {
  const { archivos } = entrada
  if (archivos.length < cantidad.minimo) {
    contexto.addIssue({ code: "custom", path: ["archivos"], message: "Falta el archivo." })
    return
  }
  if (archivos.length > cantidad.maximo) {
    const mensaje = cantidad.maximo === 1 ? "Sube un solo archivo." : "Puedes subir hasta 20 imágenes."
    contexto.addIssue({ code: "custom", path: ["archivos"], message: mensaje })
    return
  }
  const { extensiones, ayuda } = ARCHIVOS_POR_TIPO[tipoDeArchivo]
  for (const archivo of archivos) {
    if (!extensiones.includes(extensionDe(archivo.nombre))) {
      contexto.addIssue({ code: "custom", path: ["archivos"], message: ayuda })
      return
    }
  }
}

const esquemaDeCreacion = esquemaBase.superRefine((entrada, contexto) => {
  switch (entrada.tipo) {
    case "documento":
    case "audio":
    case "video":
      exigirArchivos(entrada, contexto, entrada.tipo, { minimo: 1, maximo: 1 })
      break
    case "imagen":
      exigirArchivos(entrada, contexto, "imagen", { minimo: 1, maximo: MAXIMO_DE_IMAGENES })
      break
    case "link":
      if (!entrada.url?.trim()) contexto.addIssue({ code: "custom", path: ["url"], message: "Falta el link." })
      else if (!direccionWeb.safeParse(entrada.url.trim()).success) {
        contexto.addIssue({ code: "custom", path: ["url"], message: "Ese link no parece una dirección web válida." })
      } else if (esYoutube(entrada.url) && !entrada.textoPegado?.trim()) {
        contexto.addIssue({ code: "custom", path: ["textoPegado"], message: "Pega la transcripción del video." })
      }
      if (entrada.archivos.length > 0) {
        contexto.addIssue({ code: "custom", path: ["archivos"], message: "Un link no lleva archivos." })
      }
      break
    case "post":
      if (!entrada.textoPegado?.trim()) {
        contexto.addIssue({ code: "custom", path: ["textoPegado"], message: "Falta el texto del post." })
      }
      exigirArchivos(entrada, contexto, "video", { minimo: 0, maximo: 1 })
      break
  }
  const referencia = entrada.referencia?.trim()
  if (
    (entrada.tipo === "video" || entrada.tipo === "imagen") &&
    referencia &&
    !direccionWeb.safeParse(referencia).success
  ) {
    contexto.addIssue({ code: "custom", path: ["referencia"], message: "Ese link no parece una dirección web válida." })
  }
})

export interface DatosDeCreacion {
  tipo: TipoDeMaterial
  titulo: string | null
  autorId: string
  rol: Rol
  url: string | null
  textoPegado: string | null
  /** A reference only for videos and images: it is stored and never fetched. */
  referencia: string | null
  archivos: { nombre: string; tamano: number }[]
}

export type EntradaLeida = { ok: true; datos: DatosDeCreacion } | { ok: false; error: string }

/** Pasted text is kept for a post and for the transcript of a YouTube link; any other link is opened by the worker. */
function textoQueSeGuarda(datos: { tipo: TipoDeMaterial; url?: string; textoPegado?: string }): string | null {
  const guardaTexto = datos.tipo === "post" || (datos.tipo === "link" && esYoutube(datos.url ?? ""))
  return guardaTexto ? (datos.textoPegado?.trim() ?? null) : null
}

/** Validates what the browser sent; the error is the first problem, written for the person who sees it. */
export function leerEntrada(entrada: unknown): EntradaLeida {
  // A problem nobody wrote a message for (a number where text goes) is a request this screen never sends.
  const resultado = esquemaDeCreacion.safeParse(entrada, { error: () => ERROR_SOLICITUD })
  if (!resultado.success) return { ok: false, error: resultado.error.issues[0]?.message ?? ERROR_SOLICITUD }
  const { declaracion: _declaracion, ...datos } = resultado.data
  const conReferencia = datos.tipo === "video" || datos.tipo === "imagen"
  return {
    ok: true,
    datos: {
      ...datos,
      url: datos.tipo === "link" ? (datos.url?.trim() ?? null) : null,
      textoPegado: textoQueSeGuarda(datos),
      referencia: conReferencia ? datos.referencia?.trim() || null : null,
    },
  }
}

export const esquemaDeId = z.object({ materialId: z.string().uuid() })
export { ERROR_SOLICITUD }
