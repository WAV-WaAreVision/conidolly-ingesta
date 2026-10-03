import { z } from "zod"
import type { TeoriaDelGrafo } from "./grafo"

// Pure: client components read it too, so it must not reach the server-only modules.

const Argumento = z.object({ materialId: z.string(), aporte: z.string(), cita: z.string(), ubicacion: z.string() })
const Contradiccion = z.object({ materialIds: z.array(z.string()), descripcion: z.string() })

export type ArgumentoLeido = z.infer<typeof Argumento>
export type ContradiccionLeida = z.infer<typeof Contradiccion>

export const ETIQUETA_DE_ESTADO_DE_TEORIA: Record<string, string> = {
  sintetizando: "Armándose",
  borrador: "Borrador",
  guardada: "Guardada",
  fallida: "No salió",
}

export const etiquetaDeEstadoDeTeoria = (estado: string): string => ETIQUETA_DE_ESTADO_DE_TEORIA[estado] ?? estado
export const estaSintetizando = (teoria: { estado: string }): boolean => teoria.estado === "sintetizando"

export const AVISO_SIN_SUSTENTO = "Estos materiales no alcanzan para una teoría. Prueba con otros."

export const CODIGO_SIN_SUSTENTO = "sin_sustento"

/** A theory the cards cannot back would only fail again: the database refuses the retry, so the screen does not offer it. */
export const puedeReintentarse = (teoria: { estado: string; motivoCodigo: string | null }): boolean =>
  teoria.estado === "fallida" && teoria.motivoCodigo !== CODIGO_SIN_SUSTENTO

export interface TeoriaLeida {
  id: string
  titulo: string | null
  tesis: string | null
  argumentos: ArgumentoLeido[]
  contradicciones: ContradiccionLeida[]
  categoriaId: string | null
  estado: string
  motivoFallo: string | null
  /** 'sin_sustento' | 'tope' | 'error' on a failed theory; the task writes it, the retry reads it. */
  motivoCodigo: string | null
  fuentes: { id: string; titulo: string }[]
}

interface FilaDeTeoria {
  id: string
  titulo: string | null
  tesis: string | null
  argumentos: unknown
  contradicciones: unknown
  categoria_id: string | null
  estado: string
  motivo_fallo: string | null
  motivo_codigo: string | null
  teoria_fuentes: { material_id: string; materiales: { titulo: string | null } | null }[]
}

/** What the row holds, in the shape the task writes; null when the synthesis cannot be read. */
export function aTeoriaLeida(fila: FilaDeTeoria): TeoriaLeida | null {
  const argumentos = z.array(Argumento).nullable().safeParse(fila.argumentos)
  const contradicciones = z.array(Contradiccion).nullable().safeParse(fila.contradicciones)
  if (!argumentos.success || !contradicciones.success) return null
  return {
    id: fila.id,
    titulo: fila.titulo,
    tesis: fila.tesis,
    argumentos: argumentos.data ?? [],
    contradicciones: contradicciones.data ?? [],
    categoriaId: fila.categoria_id,
    estado: fila.estado,
    motivoFallo: fila.motivo_fallo,
    motivoCodigo: fila.motivo_codigo,
    fuentes: fila.teoria_fuentes.map((f) => ({
      id: f.material_id,
      titulo: f.materiales?.titulo?.trim() || "Sin título",
    })),
  }
}

/** Only a saved theory with a title is drawn: a draft is not Coni's yet. */
export function aTeoriaDelGrafo(teoria: {
  id: string
  titulo: string | null
  estado: string
  fuentes: string[]
}): TeoriaDelGrafo | null {
  if (teoria.estado !== "guardada" || !teoria.titulo) return null
  return { id: teoria.id, nombre: teoria.titulo, materiales: teoria.fuentes }
}
