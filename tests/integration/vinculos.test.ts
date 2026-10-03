import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import type { DepsSubir } from "@/lib/ingesta/subir"
import {
  aceptarVinculo,
  cambiarRelevancia,
  crearVinculo,
  descartarVinculo,
  listarVinculos,
} from "@/lib/ingesta/vinculos"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeOtraPersona, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."
const PREFIJO = "Prueba de vinculos "
const ids: string[] = []

let coni: Db
let wav: Db
let otra: Db
let categoriaId: string
let idConi: string

const deps = (db: Db): DepsSubir => ({
  db,
  almacen: almacenEnMemoria(),
  disparar: async () => {},
  ahora: () => new Date("2026-10-03T12:00:00.000Z"),
  nuevoId: randomUUID,
  dispararTeoria: async () => {},
})

async function material(): Promise<string> {
  const id = randomUUID()
  const { error } = await servicio.from("materiales").insert({
    id,
    tipo: "documento",
    titulo: `${PREFIJO}${id.slice(0, 6)}`,
    categoria_id: categoriaId,
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: idConi,
    estado: "listo",
  })
  if (error) throw new Error(error.message)
  ids.push(id)
  return id
}

async function sugerir(x: string, y: string, extra: Partial<Database["public"]["Tables"]["vinculos"]["Insert"]> = {}) {
  const [a, b] = [x, y].sort() as [string, string]
  const { error } = await servicio
    .from("vinculos")
    .insert({ material_a: a, material_b: b, tipo: "complementa", relevancia: 3, razon: "Se parecen", ...extra })
  if (error) throw new Error(error.message)
}

const leer = async (x: string, y: string) => {
  const [a, b] = [x, y].sort() as [string, string]
  const { data } = await servicio.from("vinculos").select("*").eq("material_a", a).eq("material_b", b).single()
  return data
}

beforeAll(async () => {
  ;[coni, wav, otra] = await Promise.all([clienteDeConi(), clienteDeWav(), clienteDeOtraPersona()])
  categoriaId = (await servicio.from("categorias").select("id").eq("slug", "general").single()).data?.id ?? ""
  const { data } = await servicio.auth.admin.listUsers()
  idConi = data.users.find((u) => u.email === "coni@estudio.test")?.id ?? ""
})

afterAll(async () => {
  await servicio.from("materiales").delete().in("id", ids)
})

describe("vinculos", () => {
  it("accepts a suggestion whichever way round the pair arrives", async () => {
    const [x, y] = [await material(), await material()]
    await sugerir(x, y)

    const resultado = await aceptarVinculo(deps(coni), { materialA: y, materialB: x })

    expect(resultado).toEqual({ ok: true })
    expect(await leer(x, y)).toMatchObject({ estado: "aceptado", decidido_por: idConi })
  })

  it("discards a link and a discarded one cannot be accepted", async () => {
    const [x, y] = [await material(), await material()]
    await sugerir(x, y)

    expect(await descartarVinculo(deps(wav), { materialA: x, materialB: y })).toEqual({ ok: true })
    expect((await leer(x, y))?.estado).toBe("descartado")
    expect(await aceptarVinculo(deps(wav), { materialA: x, materialB: y })).toEqual({
      ok: false,
      error: "Ese vínculo ya está descartado.",
    })
  })

  it("says so when the link does not exist", async () => {
    const [x, y] = [await material(), await material()]

    expect(await aceptarVinculo(deps(coni), { materialA: x, materialB: y })).toEqual({
      ok: false,
      error: "Ese vínculo ya no existe.",
    })
    expect(await descartarVinculo(deps(coni), { materialA: x, materialB: y })).toEqual({
      ok: false,
      error: "Ese vínculo ya no existe.",
    })
  })

  it("changes the relevance of a link", async () => {
    const [x, y] = [await material(), await material()]
    await sugerir(x, y, { estado: "aceptado" })

    expect(await cambiarRelevancia(deps(coni), { materialA: x, materialB: y, relevancia: 5 })).toEqual({ ok: true })
    expect(await leer(x, y)).toMatchObject({ relevancia: 5, estado: "aceptado" })
  })

  it("creates a link by hand as accepted, and refuses a second one for the same pair", async () => {
    const [x, y] = [await material(), await material()]
    const entrada = { materialA: y, materialB: x, tipo: "ejemplo_de", relevancia: 4, razon: "Es un caso concreto." }

    expect(await crearVinculo(deps(coni), entrada)).toEqual({ ok: true })
    expect(await leer(x, y)).toMatchObject({
      estado: "aceptado",
      tipo: "ejemplo_de",
      relevancia: 4,
      razon: "Es un caso concreto.",
    })
    expect(await crearVinculo(deps(coni), entrada)).toEqual({ ok: false, error: "Ese vínculo ya existe." })
  })

  it("refuses a link of a material with itself, and malformed input", async () => {
    const x = await material()

    expect((await crearVinculo(deps(coni), { materialA: x, materialB: x, tipo: "amplia", relevancia: 3 })).ok).toBe(
      false,
    )
    expect((await aceptarVinculo(deps(coni), { materialA: "no", materialB: x })).ok).toBe(false)
    expect((await cambiarRelevancia(deps(coni), { materialA: x, materialB: x, relevancia: 9 })).ok).toBe(false)
    expect(
      (await crearVinculo(deps(coni), { materialA: x, materialB: await material(), tipo: "raro", relevancia: 3 })).ok,
    ).toBe(false)
  })

  it("turns away someone who is not Coni or WAV", async () => {
    const [x, y] = [await material(), await material()]
    await sugerir(x, y)

    expect(await aceptarVinculo(deps(otra), { materialA: x, materialB: y })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    expect(await descartarVinculo(deps(otra), { materialA: x, materialB: y })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    expect((await leer(x, y))?.estado).toBe("sugerido")
  })

  it("lists the links the person can see, without the discarded ones", async () => {
    const [x, y, z] = [await material(), await material(), await material()]
    await sugerir(x, y)
    await sugerir(x, z, { estado: "descartado" })

    const lista = await listarVinculos(coni)

    const mios = lista.filter((v) => [x, y, z].includes(v.material_a))
    expect(mios).toHaveLength(1)
    expect(mios[0]).toMatchObject({ estado: "sugerido", razon: "Se parecen" })
  })
})
