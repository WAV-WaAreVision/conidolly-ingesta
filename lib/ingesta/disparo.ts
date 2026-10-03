import { appendFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { idempotencyKeys, tasks } from "@trigger.dev/sdk"
import { FallaDeConfiguracion } from "@/lib/dominio/falla"
import type { ProcesarMaterial, SintetizarTeoria } from "./tarea"

type Entorno = Record<string, string | undefined>

/** The file the runs are written to in test mode, null when the runs are real. A deployed app refuses test mode. */
function archivoDeDisparoDePrueba(entorno: Entorno): string | null {
  if (entorno.DISPARO_DE_PRUEBA !== "1") return null
  if (entorno.VERCEL) {
    throw new FallaDeConfiguracion(
      "DISPARO_DE_PRUEBA no puede estar activo en Vercel: no se procesaría ningún material.",
    )
  }
  return entorno.DISPARO_DE_PRUEBA_ARCHIVO || join(tmpdir(), "conidolly-ingesta-disparos.jsonl")
}

/**
 * Starts the processing of an uploaded material. The key holds for ten minutes: a double tap starts one run. A retry
 * passes its own `intento` so the key is new and the failed run is never reused. In test mode it writes the run to a
 * file instead.
 */
export async function dispararProcesarMaterial(
  materialId: string,
  entorno: Entorno = process.env,
  intento?: string,
): Promise<void> {
  const archivo = archivoDeDisparoDePrueba(entorno)
  if (archivo) {
    appendFileSync(
      archivo,
      `${JSON.stringify({ tarea: "procesar-material", materialId, ...(intento ? { intento } : {}) })}\n`,
    )
    return
  }
  if (!entorno.TRIGGER_SECRET_KEY) {
    throw new FallaDeConfiguracion("Falta TRIGGER_SECRET_KEY: la app no puede iniciar el procesamiento del material.")
  }
  await tasks.trigger<ProcesarMaterial>(
    "procesar-material",
    { materialId },
    {
      // `scope: "global"`: the key is the same whichever request asks, so two devices or a double tap start one run.
      idempotencyKey: await idempotencyKeys.create(`procesar-material:${materialId}${intento ? `:${intento}` : ""}`, {
        scope: "global",
      }),
      idempotencyKeyTTL: "10m",
    },
  )
}

/** Starts the synthesis of a theory. Same key rules as `dispararProcesarMaterial`: one run per tap, a new one per retry. */
export async function dispararSintetizarTeoria(
  teoriaId: string,
  entorno: Entorno = process.env,
  intento?: string,
): Promise<void> {
  const archivo = archivoDeDisparoDePrueba(entorno)
  if (archivo) {
    appendFileSync(
      archivo,
      `${JSON.stringify({ tarea: "sintetizar-teoria", teoriaId, ...(intento ? { intento } : {}) })}\n`,
    )
    return
  }
  if (!entorno.TRIGGER_SECRET_KEY) {
    throw new FallaDeConfiguracion("Falta TRIGGER_SECRET_KEY: la app no puede iniciar la síntesis de la teoría.")
  }
  await tasks.trigger<SintetizarTeoria>(
    "sintetizar-teoria",
    { teoriaId },
    {
      idempotencyKey: await idempotencyKeys.create(`sintetizar-teoria:${teoriaId}${intento ? `:${intento}` : ""}`, {
        scope: "global",
      }),
      idempotencyKeyTTL: "10m",
    },
  )
}
