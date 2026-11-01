import type { SupabaseClient } from "@supabase/supabase-js"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { agregarFila, confirmarPais, guardarFila, listarRegistro, SOLO_WAV } from "@/lib/ingesta/datos-personales"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>
type FilaNueva = Database["public"]["Tables"]["inventario_de_datos"]["Insert"]

const servicio = clienteDeServicio()
const deps = (db: Db) => ({ db })
const CAMPOS = {
  dato: "Un dato de prueba",
  para_que: "Probar el registro",
  proveedor: "Supabase",
  pais: "Por confirmar",
  plazo: "Mientras dure la prueba",
  plazo_dias: null,
  orden: 99,
}

let coni: Db
let wav: Db

beforeAll(async () => {
  coni = await clienteDeConi()
  wav = await clienteDeWav()
})
afterEach(async () => {
  const { error } = await servicio.from("inventario_de_datos").delete().like("clave", "prueba_%")
  if (error) throw new Error(error.message)
})

/** A row made by the service role, which may also set the deletion rule that WAV cannot. */
async function sembrar(extra: Partial<FilaNueva> = {}): Promise<string> {
  const { data, error } = await servicio
    .from("inventario_de_datos")
    .insert({ clave: "prueba_sembrada", ...CAMPOS, ...extra })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function leer(id: string) {
  const { data, error } = await servicio.from("inventario_de_datos").select("*").eq("id", id).single()
  if (error) throw new Error(error.message)
  return data
}

describe("listarRegistro", () => {
  it("lists the register in its order, with the deletion rules", async () => {
    const filas = await listarRegistro(wav)

    expect(filas[0]).toMatchObject({ clave: "rostro_de_coni", pais_confirmado: false })
    expect(filas.find((fila) => fila.clave === "respaldos")).toMatchObject({
      regla_de_borrado: "respaldos",
      plazo_dias: 30,
    })
  })
})

describe("guardarFila", () => {
  it("lets WAV correct a row, trimming what she typed", async () => {
    const id = await sembrar()

    expect(await guardarFila(deps(wav), { id, ...CAMPOS, pais: "  Brasil ", plazo_dias: 7 })).toEqual({ ok: true })

    expect(await leer(id)).toMatchObject({ pais: "Brasil", plazo_dias: 7 })
  })

  it("refuses Coni, and the row stays as it was", async () => {
    const id = await sembrar()

    expect(await guardarFila(deps(coni), { id, ...CAMPOS, pais: "Chile" })).toEqual({ ok: false, error: SOLO_WAV })

    expect((await leer(id)).pais).toBe("Por confirmar")
  })

  it("says what is wrong with a field", async () => {
    const id = await sembrar()

    expect(await guardarFila(deps(wav), { id, ...CAMPOS, dato: "x" })).toEqual({
      ok: false,
      error: "Escribe el dato en al menos 3 letras.",
    })
  })

  it("keeps the days of a row the app deletes by itself", async () => {
    const id = await sembrar({ regla_de_borrado: "respaldos", plazo_dias: 30 })

    expect(await guardarFila(deps(wav), { id, ...CAMPOS, plazo_dias: null })).toEqual({
      ok: false,
      error: "Esta fila la borra la app sola: necesita su plazo en días.",
    })
  })

  it("asks WAV to confirm the country again when it changes", async () => {
    const id = await sembrar({ pais: "Chile", pais_confirmado: true })

    expect(await guardarFila(deps(wav), { id, ...CAMPOS, pais: "Chile", dato: "Otro dato" })).toEqual({ ok: true })
    expect((await leer(id)).pais_confirmado).toBe(true)

    expect(await guardarFila(deps(wav), { id, ...CAMPOS, pais: "Brasil" })).toEqual({ ok: true })
    expect(await leer(id)).toMatchObject({ pais: "Brasil", pais_confirmado: false })
  })

  it("refuses more days than a hundred years", async () => {
    const id = await sembrar()

    expect(await guardarFila(deps(wav), { id, ...CAMPOS, plazo_dias: 36501 })).toEqual({
      ok: false,
      error: "Los días no pueden pasar de 36500 (cien años).",
    })
  })

  it("says so when the row no longer exists", async () => {
    expect(await guardarFila(deps(wav), { id: "00000000-0000-4000-8000-000000000000", ...CAMPOS })).toEqual({
      ok: false,
      error: "Esa fila ya no existe. Recarga la página.",
    })
  })
})

describe("agregarFila", () => {
  it("lets WAV add a row, once per key", async () => {
    expect(await agregarFila(deps(wav), { clave: "prueba_nueva", ...CAMPOS })).toEqual({
      ok: true,
      id: expect.any(String),
    })
    expect(await agregarFila(deps(wav), { clave: "prueba_nueva", ...CAMPOS })).toEqual({
      ok: false,
      error: "Ya hay una fila con esa clave.",
    })
  })

  it("refuses Coni, and nothing is added", async () => {
    expect(await agregarFila(deps(coni), { clave: "prueba_de_coni", ...CAMPOS })).toEqual({
      ok: false,
      error: SOLO_WAV,
    })

    const { data, error } = await servicio.from("inventario_de_datos").select("id").eq("clave", "prueba_de_coni")
    if (error) throw new Error(error.message)
    expect(data).toEqual([])
  })

  it("refuses a key that is not lowercase with underscores", async () => {
    expect(await agregarFila(deps(wav), { clave: "Prueba Nueva", ...CAMPOS })).toEqual({
      ok: false,
      error: "La clave va en minúsculas y con guiones bajos, de 3 a 40 letras (por ejemplo, comentarios_de_riesgo).",
    })
  })
})

describe("confirmarPais", () => {
  it("marks the country as confirmed", async () => {
    const id = await sembrar({ pais: "Chile" })

    expect(await confirmarPais(deps(wav), { id })).toEqual({ ok: true })

    expect((await leer(id)).pais_confirmado).toBe(true)
  })

  it("refuses a country that was never written down, in any case", async () => {
    for (const [clave, pais] of [
      ["prueba_tal_cual", "Por confirmar"],
      ["prueba_mayusculas", " por CONFIRMAR "],
    ]) {
      const id = await sembrar({ clave, pais })

      expect(await confirmarPais(deps(wav), { id })).toEqual({
        ok: false,
        error: "Escribe el país y guárdalo antes de confirmarlo.",
      })
      expect((await leer(id)).pais_confirmado).toBe(false)
    }
  })

  it("says so when the row no longer exists", async () => {
    expect(await confirmarPais(deps(wav), { id: "00000000-0000-4000-8000-000000000000" })).toEqual({
      ok: false,
      error: "Esa fila ya no existe. Recarga la página.",
    })
  })

  it("refuses Coni", async () => {
    const id = await sembrar()

    expect(await confirmarPais(deps(coni), { id })).toEqual({ ok: false, error: SOLO_WAV })
    expect((await leer(id)).pais_confirmado).toBe(false)
  })
})
