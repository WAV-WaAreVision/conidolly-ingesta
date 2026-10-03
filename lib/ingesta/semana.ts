import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { ERROR_GENERICO, type Resultado } from "@/lib/acciones/resultado"
import type { Database } from "@/lib/supabase/database.types"
import { leerTodas } from "./paginas"
import { semanaDe } from "./semana-de"
import { exigirMiembro } from "./subir"

type Db = SupabaseClient<Database>

export interface DepsSemana {
  /** The client of the signed-in person: row level security decides what she reads. */
  db: Db
  /** Starts the manual run of the engine for the week that ends on that Sunday. */
  dispararMotor: (semana: string) => Promise<void>
  ahora: () => Date
}

export interface TemaDeTeoria {
  id: string
  nombre: string
}

export interface CorridaLeida {
  semana: string
  estado: string
  costoUsd: number
  ideas: number
  manual: boolean
  motivoFallo: string | null
  creadaEn: string
  terminadaEn: string | null
}

export interface TeoriaEscrita {
  id: string
  titulo: string
  tesis: string
  puntaje: number | null
  nivelEvidencia: string | null
  temas: TemaDeTeoria[]
}

export interface CruceDescartado {
  id: string
  razon: string
  puntaje: number | null
  temas: TemaDeTeoria[]
}

export interface QueSubir {
  unSoloAutor: string[]
  pilaresSinMaterial: string[]
}

export interface SemanaLeida {
  corrida: CorridaLeida | null
  teorias: TeoriaEscrita[]
  descartadas: CruceDescartado[]
  queSubir: QueSubir | null
}

const YA_PROPUSO = "El motor ya propuso ideas esta semana. Vuelve el domingo."
const NO_ARRANCO = "No pude pedirle ideas al motor. Inténtalo de nuevo en unos minutos."
/** The engine retakes a run stuck in `corriendo` after this long (`MINUTOS_PARA_RETOMAR` in estudio-coni): until then it is alive. */
const MINUTOS_DE_UNA_CORRIDA_VIVA = 30
const MS_POR_MINUTO = 60_000

const Resumen = z.object({
  ideas: z.number().catch(0),
  manual: z.boolean().catch(false),
  queSubir: z
    .object({ unSoloAutor: z.array(z.string()), pilaresSinMaterial: z.array(z.string()) })
    .nullable()
    .catch(null),
})

/** `jsonb` that is not the shape the engine writes is read as empty rather than breaking the whole screen. */
const leerResumen = (valor: unknown) => Resumen.catch({ ideas: 0, manual: false, queSubir: null }).parse(valor)

const nombresDe = async (db: Db, ids: string[]): Promise<Map<string, string>> => {
  const unicos = [...new Set(ids)]
  const nombres = new Map<string, string>()
  const POR_CONSULTA = 100
  for (let desde = 0; desde < unicos.length; desde += POR_CONSULTA) {
    const { data, error } = await db
      .from("temas")
      .select("id, nombre")
      .in("id", unicos.slice(desde, desde + POR_CONSULTA))
    if (error) throw new Error(`No pude leer los temas de las teorías: ${error.message}`, { cause: error })
    for (const tema of data) nombres.set(tema.id, tema.nombre)
  }
  return nombres
}

/**
 * The latest run of the engine with the theories and discarded crossings of its week, and what the run says to upload
 * next. Everything is empty before the first run. A topic that no longer exists drops out of its theory's links.
 */
export async function leerSemana(db: Db): Promise<SemanaLeida> {
  const { data: corridas, error } = await db
    .from("motor_corridas")
    .select("semana, estado, costo_usd, resumen, motivo_fallo, creada_en, terminada_en")
    .order("semana", { ascending: false })
    .limit(1)
  if (error) throw new Error(`No pude leer la última corrida del motor: ${error.message}`, { cause: error })
  const fila = corridas[0]
  if (!fila) return { corrida: null, teorias: [], descartadas: [], queSubir: null }

  const resumen = leerResumen(fila.resumen)
  const filas = await leerTodas(`las teorías de la semana ${fila.semana}`, (desde, hasta) =>
    db
      .from("teorias")
      .select("id, estado, titulo, tesis, puntaje, nivel_evidencia, motivo_fallo, temas")
      .eq("origen", "motor")
      .eq("semana", fila.semana)
      .in("estado", ["guardada", "descartada_por_motor"])
      .order("puntaje", { ascending: false, nullsFirst: false })
      .order("id")
      .range(desde, hasta),
  )
  const nombres = await nombresDe(
    db,
    filas.flatMap((teoria) => teoria.temas),
  )
  const temasDe = (ids: string[]): TemaDeTeoria[] =>
    ids.flatMap((id) => {
      const nombre = nombres.get(id)
      return nombre === undefined ? [] : [{ id, nombre }]
    })

  return {
    corrida: {
      semana: fila.semana,
      estado: fila.estado,
      costoUsd: Number(fila.costo_usd),
      ideas: resumen.ideas,
      manual: resumen.manual,
      motivoFallo: fila.motivo_fallo,
      creadaEn: fila.creada_en,
      terminadaEn: fila.terminada_en,
    },
    teorias: filas
      .filter((teoria) => teoria.estado === "guardada")
      .map((teoria) => ({
        id: teoria.id,
        titulo: teoria.titulo ?? "",
        tesis: teoria.tesis ?? "",
        puntaje: teoria.puntaje,
        nivelEvidencia: teoria.nivel_evidencia,
        temas: temasDe(teoria.temas),
      })),
    descartadas: filas
      .filter((teoria) => teoria.estado === "descartada_por_motor")
      .map((teoria) => ({
        id: teoria.id,
        razon: teoria.motivo_fallo ?? "",
        puntaje: teoria.puntaje,
        temas: temasDe(teoria.temas),
      })),
    queSubir: resumen.queSubir,
  }
}

/**
 * "Proponer ahora": asks the engine for this week unless this week already has a ready run or one that is still going.
 * A failed week is asked again, because the engine retakes it. The key of the run is the Sunday that closes the week.
 */
export async function proponerAhora(deps: DepsSemana): Promise<Resultado> {
  const miembro = await exigirMiembro(deps.db, "proponerAhora")
  if (!miembro.ok) return miembro

  const ahora = deps.ahora()
  const semana = semanaDe(ahora)
  const { data, error } = await deps.db
    .from("motor_corridas")
    .select("estado, creada_en")
    .eq("semana", semana)
    .maybeSingle()
  if (error) {
    console.error(`No pude leer la corrida del motor de la semana ${semana}`, error)
    return { ok: false, error: ERROR_GENERICO }
  }
  if (data) {
    const minutos = (ahora.getTime() - Date.parse(data.creada_en)) / MS_POR_MINUTO
    if (data.estado === "lista" || (data.estado === "corriendo" && minutos < MINUTOS_DE_UNA_CORRIDA_VIVA)) {
      return { ok: false, error: YA_PROPUSO }
    }
  }
  try {
    await deps.dispararMotor(semana)
  } catch (falla) {
    console.error(`No pude iniciar el motor para la semana ${semana}`, falla)
    return { ok: false, error: NO_ARRANCO }
  }
  return { ok: true }
}
