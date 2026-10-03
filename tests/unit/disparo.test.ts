import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { idempotencyKeys, tasks } from "@trigger.dev/sdk"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FallaDeConfiguracion } from "@/lib/dominio/falla"
import { dispararProcesarMaterial } from "@/lib/ingesta/disparo"

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: vi.fn(async () => ({ id: "run_1" })) },
  idempotencyKeys: { create: vi.fn(async (clave: string) => `clave-creada:${clave}`) },
}))

const ID = "11111111-2222-4333-8444-555555555555"

afterEach(() => {
  vi.clearAllMocks()
})

describe("dispararProcesarMaterial", () => {
  it("writes the run it would start to a file, and calls nothing, when DISPARO_DE_PRUEBA is on", async () => {
    const archivo = join(mkdtempSync(join(tmpdir(), "disparos-")), "registro.jsonl")

    await dispararProcesarMaterial(ID, { DISPARO_DE_PRUEBA: "1", DISPARO_DE_PRUEBA_ARCHIVO: archivo })

    const lineas = readFileSync(archivo, "utf-8").trim().split("\n")
    expect(lineas.map((linea) => JSON.parse(linea))).toEqual([{ tarea: "procesar-material", materialId: ID }])
    expect(tasks.trigger).not.toHaveBeenCalled()
  })

  it("never records instead of starting when it runs on Vercel", async () => {
    await expect(dispararProcesarMaterial(ID, { DISPARO_DE_PRUEBA: "1", VERCEL: "1" })).rejects.toThrow(
      FallaDeConfiguracion,
    )
  })

  it("asks for the Trigger.dev key before starting anything for real", async () => {
    await expect(dispararProcesarMaterial(ID, {})).rejects.toThrow(/TRIGGER_SECRET_KEY/)
    expect(tasks.trigger).not.toHaveBeenCalled()
  })

  it("starts procesar-material with one idempotency key per material that holds for ten minutes", async () => {
    await dispararProcesarMaterial(ID, { TRIGGER_SECRET_KEY: "tr_dev_x" })

    expect(idempotencyKeys.create).toHaveBeenCalledWith(`procesar-material:${ID}`, { scope: "global" })
    expect(tasks.trigger).toHaveBeenCalledWith(
      "procesar-material",
      { materialId: ID },
      { idempotencyKey: `clave-creada:procesar-material:${ID}`, idempotencyKeyTTL: "10m" },
    )
  })

  it("uses a key of its own for each retry attempt, so a failed run is never reused", async () => {
    await dispararProcesarMaterial(ID, { TRIGGER_SECRET_KEY: "tr_dev_x" }, "intento-2")

    expect(idempotencyKeys.create).toHaveBeenCalledWith(`procesar-material:${ID}:intento-2`, { scope: "global" })
  })

  it("records the attempt in test mode too", async () => {
    const archivo = join(mkdtempSync(join(tmpdir(), "disparos-")), "registro.jsonl")

    await dispararProcesarMaterial(ID, { DISPARO_DE_PRUEBA: "1", DISPARO_DE_PRUEBA_ARCHIVO: archivo }, "intento-2")

    expect(JSON.parse(readFileSync(archivo, "utf-8").trim())).toEqual({
      tarea: "procesar-material",
      materialId: ID,
      intento: "intento-2",
    })
  })
})
