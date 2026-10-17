import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { type DepsSemana, leerSemana, proponerAhora } from "@/lib/ingesta/semana"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeOtraPersona, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const PREFIJO = "Prueba de semana "
const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."
const YA_PROPUSO = "El motor ya propuso ideas esta semana. Puedes pedir otras desde el lunes."
const VECTOR_NULO = `[${new Array(1024).fill(0).join(",")}]`
const AHORA = new Date("2026-10-03T12:00:00.000Z")
const ESTA_SEMANA = "2026-10-04"
const sufijo = () => randomUUID().slice(0, 6)
const disparos: string[] = []

const deps = (db: Db, ahora = AHORA): DepsSemana => ({
  db,
  dispararMotor: async (semana) => {
    disparos.push(semana)
  },
  ahora: () => ahora,
})

let coni: Db
let wav: Db
let otra: Db

async function sembrarTema(nombre: string): Promise<string> {
  const { data, error } = await servicio
    .from("temas")
    .insert({ nombre: `${PREFIJO}${nombre} ${sufijo()}`, centroide: VECTOR_NULO })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function sembrarCorrida(
  semana: string,
  extra: Partial<Database["public"]["Tables"]["motor_corridas"]["Insert"]> = {},
) {
  const { error } = await servicio.from("motor_corridas").insert({ semana, estado: "lista", ...extra })
  if (error) throw new Error(error.message)
}

async function sembrarTeoria(extra: Partial<Database["public"]["Tables"]["teorias"]["Insert"]>) {
  const { error } = await servicio.from("teorias").insert({ origen: "motor", semana: ESTA_SEMANA, ...extra })
  if (error) throw new Error(error.message)
}

async function limpiar() {
  await servicio.from("teorias").delete().eq("origen", "motor")
  await servicio.from("teorias").delete().like("titulo", `${PREFIJO}%`)
  await servicio.from("motor_corridas").delete().gte("semana", "2000-01-01")
  await servicio.from("temas").delete().like("nombre", `${PREFIJO}%`)
}

beforeAll(async () => {
  ;[coni, wav, otra] = await Promise.all([clienteDeConi(), clienteDeWav(), clienteDeOtraPersona()])
})

beforeEach(async () => {
  disparos.length = 0
  await limpiar()
})

afterAll(limpiar)

describe("leerSemana", () => {
  it("has nothing to show before the engine has ever run", async () => {
    expect(await leerSemana(coni)).toEqual({ corrida: null, teorias: [], descartadas: [], queSubir: null })
  })

  it("reads the latest run: week, state, cost, ideas and whether it was manual", async () => {
    await sembrarCorrida("2026-09-27", { resumen: { ideas: 3 }, costo_usd: 0.5 })
    await sembrarCorrida(ESTA_SEMANA, {
      resumen: { ideas: 9, manual: true },
      costo_usd: 1.2345,
      terminada_en: "2026-10-04T23:10:00Z",
    })

    const { corrida } = await leerSemana(wav)

    expect(corrida).toMatchObject({ semana: ESTA_SEMANA, estado: "lista", costoUsd: 1.2345, ideas: 9, manual: true })
    expect(Date.parse(corrida?.terminadaEn ?? "")).toBe(Date.parse("2026-10-04T23:10:00Z"))
  })

  it("carries the reason of a failed run", async () => {
    await sembrarCorrida(ESTA_SEMANA, { estado: "fallida", motivo_fallo: "Claude no respondió" })

    expect((await leerSemana(coni)).corrida).toMatchObject({ estado: "fallida", motivoFallo: "Claude no respondió" })
  })

  it("lists the written theories of that week with their crossed topics, and the discarded crossings with their reason", async () => {
    const [uno, dos, tres] = await Promise.all([sembrarTema("Apego"), sembrarTema("Deseo"), sembrarTema("Límites")])
    await sembrarCorrida(ESTA_SEMANA)
    await sembrarTeoria({
      estado: "guardada",
      titulo: "El apego explica el deseo",
      tesis: "Quien se siente seguro desea más.",
      temas: [uno, dos],
      puntaje: 0.82,
      nivel_evidencia: "alto",
    })
    await sembrarTeoria({
      estado: "descartada_por_motor",
      motivo_fallo: "Los autores no se refieren a lo mismo",
      temas: [dos, tres],
      puntaje: 0.4,
    })
    await sembrarTeoria({ estado: "guardada", semana: "2026-09-27", titulo: "De otra semana", temas: [uno] })
    await sembrarTeoria({ estado: "guardada", origen: "manual", titulo: `${PREFIJO}Escrita a mano`, temas: [uno] })

    const { teorias, descartadas } = await leerSemana(coni)

    expect(teorias).toHaveLength(1)
    expect(teorias[0]).toMatchObject({
      titulo: "El apego explica el deseo",
      tesis: "Quien se siente seguro desea más.",
      puntaje: 0.82,
      nivelEvidencia: "alto",
    })
    expect(teorias[0]?.temas.map((tema) => tema.id)).toEqual([uno, dos])
    expect(teorias[0]?.temas[0]?.nombre).toContain("Apego")
    expect(descartadas).toHaveLength(1)
    expect(descartadas[0]).toMatchObject({ razon: "Los autores no se refieren a lo mismo", puntaje: 0.4 })
    expect(descartadas[0]?.temas.map((tema) => tema.id)).toEqual([dos, tres])
  })

  it("orders the theories by score, best first", async () => {
    await sembrarCorrida(ESTA_SEMANA)
    await sembrarTeoria({ estado: "guardada", titulo: "Floja", puntaje: 0.3 })
    await sembrarTeoria({ estado: "guardada", titulo: "Fuerte", puntaje: 0.9 })

    expect((await leerSemana(coni)).teorias.map((teoria) => teoria.titulo)).toEqual(["Fuerte", "Floja"])
  })

  it("reads what to upload next from the summary of the run", async () => {
    await sembrarCorrida(ESTA_SEMANA, {
      resumen: { queSubir: { unSoloAutor: ["Apego", "Celos"], pilaresSinMaterial: ["general"] } },
    })

    expect((await leerSemana(coni)).queSubir).toEqual({
      unSoloAutor: ["Apego", "Celos"],
      pilaresSinMaterial: ["general"],
    })
  })

  it("drops a retired pillar a stored run still asks material for", async () => {
    await sembrarCorrida(ESTA_SEMANA, {
      resumen: { queSubir: { unSoloAutor: [], pilaresSinMaterial: ["limites", "ia-salud-mental"] } },
    })

    expect((await leerSemana(coni)).queSubir?.pilaresSinMaterial).toEqual(["ia-salud-mental"])
  })

  it("reads a summary that is not the shape the engine writes as empty instead of breaking", async () => {
    await sembrarCorrida(ESTA_SEMANA, { resumen: { ideas: "muchas", queSubir: 7 } })

    const { corrida, queSubir } = await leerSemana(coni)

    expect(corrida).toMatchObject({ ideas: 0, manual: false })
    expect(queSubir).toBeNull()
  })

  it("shows nothing to someone who is not Coni or WAV", async () => {
    await sembrarCorrida(ESTA_SEMANA)

    expect((await leerSemana(otra)).corrida).toBeNull()
  })
})

describe("proponerAhora", () => {
  it("asks the engine for this week when nothing ran yet", async () => {
    expect(await proponerAhora(deps(coni))).toEqual({ ok: true })
    expect(disparos).toEqual([ESTA_SEMANA])
  })

  it("lets WAV ask too", async () => {
    expect(await proponerAhora(deps(wav))).toEqual({ ok: true })
    expect(disparos).toEqual([ESTA_SEMANA])
  })

  it("refuses someone who is not Coni or WAV and starts nothing", async () => {
    expect(await proponerAhora(deps(otra))).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    expect(disparos).toEqual([])
  })

  it("says the engine already proposed when this week's run is ready, and starts nothing", async () => {
    await sembrarCorrida(ESTA_SEMANA, { estado: "lista" })

    expect(await proponerAhora(deps(coni))).toEqual({ ok: false, error: YA_PROPUSO })
    expect(disparos).toEqual([])
  })

  it("says the same until the engine itself would retake a stuck run, 30 minutes", async () => {
    await sembrarCorrida(ESTA_SEMANA, {
      estado: "corriendo",
      creada_en: new Date(AHORA.getTime() - 29 * 60_000).toISOString(),
    })

    expect(await proponerAhora(deps(coni))).toEqual({ ok: false, error: YA_PROPUSO })
    expect(disparos).toEqual([])
  })

  it("starts again once a run has been going for more than the 30 minutes the engine waits", async () => {
    await sembrarCorrida(ESTA_SEMANA, {
      estado: "corriendo",
      creada_en: new Date(AHORA.getTime() - 31 * 60_000).toISOString(),
    })

    expect(await proponerAhora(deps(coni))).toEqual({ ok: true })
    expect(disparos).toEqual([ESTA_SEMANA])
  })

  it("starts again when this week's run failed, because the engine retakes failed weeks", async () => {
    await sembrarCorrida(ESTA_SEMANA, { estado: "fallida", motivo_fallo: "x" })

    expect(await proponerAhora(deps(coni))).toEqual({ ok: true })
    expect(disparos).toEqual([ESTA_SEMANA])
  })

  it("is not stopped by the run of another week", async () => {
    await sembrarCorrida("2026-09-27", { estado: "lista" })

    expect(await proponerAhora(deps(coni))).toEqual({ ok: true })
  })

  it("keys the run on the Sunday that closes the week in Santiago, not on the UTC date", async () => {
    // Saturday 23:30 in Santiago is already Sunday in UTC.
    await proponerAhora(deps(coni, new Date("2026-10-04T02:30:00Z")))

    expect(disparos).toEqual(["2026-10-04"])
  })

  it("answers with a plain failure when the engine cannot be started", async () => {
    const falla = { ...deps(coni), dispararMotor: async () => Promise.reject(new Error("sin llave")) }

    const resultado = await proponerAhora(falla)

    expect(resultado.ok).toBe(false)
  })
})
