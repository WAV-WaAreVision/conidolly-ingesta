import { z } from "zod"
import type { Json } from "@/lib/supabase/database.types"
import { ERROR_SOLICITUD } from "./modelo"

// The shape of the card that `procesar-material` of estudio-coni writes into `fichas`. The repos do not import each
// other: keep `Ubicacion` and the fields in step with `lib/ingesta/partes.ts` and `procesar.ts` there.

export const Ubicacion = z.union([
  z.object({ pagina: z.number().nullable() }).strict(),
  z.object({ segundo: z.number(), pista: z.enum(["voz", "pantalla"]) }).strict(),
  z.object({ imagen: z.number() }).strict(),
])
export type Ubicacion = z.infer<typeof Ubicacion>

const Cita = z.object({ texto: z.string(), ubicacion: Ubicacion })
const Fuente = z.object({
  autor: z.string().nullable(),
  anio: z.number().nullable(),
  enlace: z.string().nullable(),
})

export interface FichaLeida {
  resumen: string
  ideasClave: string[]
  citas: { texto: string; ubicacion: Ubicacion }[]
  fuente: { autor: string | null; anio: number | null; enlace: string | null }
}

const Columnas = z.object({
  resumen: z.string(),
  ideas_clave: z.array(z.string()),
  citas: z.array(Cita),
  fuente: Fuente,
})

/** The card from the json columns, null when they do not have the shape the task writes. */
export function leerFicha(fila: { resumen: string; ideas_clave: Json; citas: Json; fuente: Json }): FichaLeida | null {
  const leida = Columnas.safeParse(fila)
  if (!leida.success) return null
  const { resumen, ideas_clave, citas, fuente } = leida.data
  return { resumen, ideasClave: ideas_clave, citas, fuente }
}

/** Where a quote lives in its source, as Coni reads it: "página 12", "1:15" or "imagen 3"; null when it has none. */
export function textoDeUbicacion(ubicacion: Ubicacion): string | null {
  if ("segundo" in ubicacion) {
    const total = Math.floor(ubicacion.segundo)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
  }
  if ("imagen" in ubicacion) return `imagen ${ubicacion.imagen}`
  return ubicacion.pagina === null ? null : `página ${ubicacion.pagina}`
}

/** Each name goes after "del": the languages Coni's references come in. */
const IDIOMAS: Record<string, string> = {
  en: "inglés",
  pt: "portugués",
  fr: "francés",
  de: "alemán",
  it: "italiano",
  ca: "catalán",
  nl: "neerlandés",
  ru: "ruso",
  ja: "japonés",
  zh: "chino",
  ko: "coreano",
  ar: "árabe",
}

/** How the card was made: translated and adapted to Coni's voice, or only adapted when the original is Spanish. */
export function adaptacionDe(idiomaOriginal: string | null): string {
  if (idiomaOriginal === null || idiomaOriginal === "es") return "Adaptado a la voz de Coni"
  const idioma = IDIOMAS[idiomaOriginal]
  return `Traducido ${idioma ? `del ${idioma}` : "de otro idioma"} y adaptado a la voz de Coni`
}

export const MINIMO_DE_IDEAS = 5
export const MAXIMO_DE_IDEAS = 10
const MAXIMO_DE_RESUMEN = 5000
const MAXIMO_DE_IDEA = 500
const MAXIMO_DE_CITA = 2000
const MAXIMO_DE_CITAS = 20

const texto = (maximo: number) => z.string().trim().max(maximo)
const textoONulo = z
  .string()
  .nullable()
  .transform((valor) => valor?.trim() || null)

const esquemaDeEdicion = z.object({
  materialId: z.string().uuid(),
  resumen: texto(MAXIMO_DE_RESUMEN),
  ideasClave: z.array(texto(MAXIMO_DE_IDEA)).max(MAXIMO_DE_IDEAS + 10),
  citas: z.array(z.object({ texto: texto(MAXIMO_DE_CITA), ubicacion: Ubicacion })).max(MAXIMO_DE_CITAS),
  fuente: z.object({
    autor: textoONulo,
    anio: z.number().int().min(0).max(3000).nullable(),
    enlace: textoONulo,
  }),
})

export type EdicionDeFicha = z.infer<typeof esquemaDeEdicion>
export type EdicionLeida = { ok: true; datos: EdicionDeFicha } | { ok: false; error: string }

function esEnlaceWeb(enlace: string): boolean {
  try {
    const { protocol } = new URL(enlace)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/** Validates an edit of a card; blank ideas and quotes are dropped before counting. The error is for the person. */
export function leerEdicion(entrada: unknown): EdicionLeida {
  const leida = esquemaDeEdicion.safeParse(entrada)
  if (!leida.success) return { ok: false, error: ERROR_SOLICITUD }
  const datos = {
    ...leida.data,
    ideasClave: leida.data.ideasClave.filter((idea) => idea !== ""),
    citas: leida.data.citas.filter((cita) => cita.texto !== ""),
  }
  if (datos.resumen === "") return { ok: false, error: "El resumen no puede quedar vacío." }
  if (datos.ideasClave.length < MINIMO_DE_IDEAS || datos.ideasClave.length > MAXIMO_DE_IDEAS) {
    return { ok: false, error: `Deja entre ${MINIMO_DE_IDEAS} y ${MAXIMO_DE_IDEAS} ideas clave.` }
  }
  if (datos.fuente.enlace !== null && !esEnlaceWeb(datos.fuente.enlace)) {
    return { ok: false, error: "El enlace de la fuente no es válido." }
  }
  return { ok: true, datos }
}
