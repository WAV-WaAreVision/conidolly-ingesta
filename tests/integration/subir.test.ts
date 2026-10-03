import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import { TAMANO_MAXIMO_BYTES } from "@/lib/ingesta/modelo"
import {
  confirmarMaterial,
  crearCategoria,
  crearMaterial,
  type DepsSubir,
  descartarMaterial,
} from "@/lib/ingesta/subir"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeOtraPersona, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const creados: string[] = []
const disparos: string[] = []
const almacen = almacenEnMemoria()
const AHORA = new Date("2026-10-03T12:00:00.000Z")
const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."
const PREFIJO = "Prueba de subir "

let coni: Db
let wav: Db
let otra: Db
let categoriaId: string

const deps = (db: Db): DepsSubir => ({
  db,
  almacen,
  disparar: async (id) => {
    disparos.push(id)
  },
  ahora: () => AHORA,
  nuevoId: randomUUID,
  dispararTeoria: async () => {},
})

const base = () => ({ categoriaId, etiquetas: ["apego", "pareja"], declaracion: true })

async function crearOk(db: Db, entrada: Record<string, unknown>) {
  const resultado = await crearMaterial(deps(db), { ...base(), ...entrada })
  if (!resultado.ok) throw new Error(`crearMaterial falló: ${resultado.error}`)
  creados.push(resultado.materialId)
  return resultado
}

async function fila(id: string) {
  const { data, error } = await servicio.from("materiales").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

beforeAll(async () => {
  ;[coni, wav, otra] = await Promise.all([clienteDeConi(), clienteDeWav(), clienteDeOtraPersona()])
  const { data, error } = await servicio.from("categorias").select("id").eq("slug", "general").single()
  if (error) throw new Error(error.message)
  categoriaId = data.id
})

afterEach(async () => {
  disparos.length = 0
  if (creados.length > 0) await servicio.from("materiales").delete().in("id", creados.splice(0))
})

afterAll(async () => {
  await servicio.from("categorias").delete().like("nombre", `${PREFIJO}%`)
})

describe("crearMaterial", () => {
  it("as Coni, creates a procesando row owned by her and gives a signed PUT for the file", async () => {
    const resultado = await crearOk(coni, {
      tipo: "documento",
      titulo: "Apego adulto",
      autor: "Esther Perel",
      archivos: [{ nombre: "Tesis.PDF", tamano: 5000 }],
    })

    const material = await fila(resultado.materialId)
    expect(material).toMatchObject({
      tipo: "documento",
      titulo: "Apego adulto",
      autor: "Esther Perel",
      categoria_id: categoriaId,
      etiquetas: ["apego", "pareja"],
      estado: "procesando",
    })
    expect(new Date(material?.declaracion_sin_pacientes_en ?? 0).toISOString()).toBe(AHORA.toISOString())
    expect(material?.subido_por).toBe((await coni.auth.getUser()).data.user?.id)
    expect(material?.archivo_clave).toBe(`materiales/${resultado.materialId}/original.pdf`)
    expect(resultado.subidas).toHaveLength(1)
    expect(resultado.subidas[0]).toMatchObject({ orden: 1, tipoContenido: "application/pdf" })
    expect(resultado.subidas[0]?.url).toContain(material?.archivo_clave ?? "no hay clave")
  })

  it("lets WAV create one too, as the one who uploaded it", async () => {
    const resultado = await crearOk(wav, { tipo: "audio", archivos: [{ nombre: "charla.mp3", tamano: 10 }] })

    expect((await fila(resultado.materialId))?.subido_por).toBe((await wav.auth.getUser()).data.user?.id)
  })

  it("refuses anyone who is neither Coni nor WAV and writes nothing", async () => {
    const resultado = await crearMaterial(deps(otra), {
      ...base(),
      tipo: "link",
      url: "https://example.com/nota",
      archivos: [],
    })

    expect(resultado).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    const { count } = await servicio
      .from("materiales")
      .select("id", { count: "exact", head: true })
      .eq("origen_url", "https://example.com/nota")
    expect(count).toBe(0)
  })

  it("refuses a request that is not valid before touching the database", async () => {
    const resultado = await crearMaterial(deps(coni), { ...base(), tipo: "documento", archivos: [] })

    expect(resultado).toEqual({ ok: false, error: "Falta el archivo." })
  })

  it("refuses a file over 2 GB by its declared size, before presigning", async () => {
    const resultado = await crearMaterial(deps(coni), {
      ...base(),
      tipo: "video",
      archivos: [{ nombre: "clase.mp4", tamano: TAMANO_MAXIMO_BYTES + 1 }],
    })

    expect(resultado).toEqual({ ok: false, error: "Ese archivo pesa más de 2 GB." })
  })

  it("stores a link as its address and needs no upload", async () => {
    const resultado = await crearOk(coni, { tipo: "link", url: "https://example.com/nota", archivos: [] })

    expect(resultado.subidas).toEqual([])
    expect(await fila(resultado.materialId)).toMatchObject({
      origen_url: "https://example.com/nota",
      archivo_clave: null,
    })
  })

  it("stores a post as its pasted text, with an optional video", async () => {
    const solo = await crearOk(coni, { tipo: "post", textoPegado: "Un texto largo", archivos: [] })
    const conVideo = await crearOk(coni, {
      tipo: "post",
      textoPegado: "Con video",
      archivos: [{ nombre: "v.mov", tamano: 10 }],
    })

    expect(await fila(solo.materialId)).toMatchObject({ texto_pegado: "Un texto largo", archivo_clave: null })
    expect((await fila(conVideo.materialId))?.archivo_clave).toMatch(/original\.mov$/)
    expect(conVideo.subidas[0]?.tipoContenido).toBe("video/quicktime")
  })

  it("keeps the reference link of a video, which is never fetched", async () => {
    const resultado = await crearOk(coni, {
      tipo: "video",
      autor: "@cuenta",
      referencia: "https://instagram.com/reel/x",
      archivos: [{ nombre: "v.mp4", tamano: 10 }],
    })

    expect(await fila(resultado.materialId)).toMatchObject({
      autor: "@cuenta",
      origen_url: "https://instagram.com/reel/x",
    })
  })

  it("saves each image in order and points archivo_clave at the first", async () => {
    const resultado = await crearOk(coni, {
      tipo: "imagen",
      archivos: [
        { nombre: "a.jpg", tamano: 10 },
        { nombre: "b.PNG", tamano: 10 },
        { nombre: "c.heic", tamano: 10 },
      ],
    })

    const material = await fila(resultado.materialId)
    const { data } = await servicio
      .from("materiales_archivos")
      .select("orden, archivo_clave")
      .eq("material_id", resultado.materialId)
      .order("orden")
    expect(data?.map((a) => a.orden)).toEqual([1, 2, 3])
    expect(data?.map((a) => a.archivo_clave.replace(/^materiales\/[0-9a-f-]{36}\//, ""))).toEqual([
      "original-01.jpg",
      "original-02.png",
      "original-03.heic",
    ])
    expect(material?.archivo_clave).toBe(data?.[0]?.archivo_clave)
    expect(resultado.subidas.map((s) => [s.orden, s.tipoContenido])).toEqual([
      [1, "image/jpeg"],
      [2, "image/png"],
      [3, "image/heic"],
    ])
  })

  it("says the category is gone when it does not exist anymore", async () => {
    const resultado = await crearMaterial(deps(coni), {
      ...base(),
      categoriaId: randomUUID(),
      tipo: "link",
      url: "https://example.com/otra",
      archivos: [],
    })

    expect(resultado).toEqual({ ok: false, error: "Esa categoría ya no existe. Elige otra." })
  })
})

describe("confirmarMaterial", () => {
  it("triggers the processing once the file is in the store", async () => {
    const creado = await crearOk(coni, { tipo: "documento", archivos: [{ nombre: "a.pdf", tamano: 4 }] })
    almacen.simularSubida(creado.subidas[0]?.url ?? "", new Uint8Array([1, 2, 3, 4]))

    const resultado = await confirmarMaterial(deps(coni), { materialId: creado.materialId })

    expect(resultado).toEqual({ ok: true })
    expect(disparos).toEqual([creado.materialId])
  })

  it("triggers a link right away: there is no file to wait for", async () => {
    const creado = await crearOk(coni, { tipo: "link", url: "https://example.com/z", archivos: [] })

    expect(await confirmarMaterial(deps(coni), { materialId: creado.materialId })).toEqual({ ok: true })
    expect(disparos).toEqual([creado.materialId])
  })

  it("needs every image of the material to be there", async () => {
    const creado = await crearOk(coni, {
      tipo: "imagen",
      archivos: [
        { nombre: "a.jpg", tamano: 1 },
        { nombre: "b.jpg", tamano: 1 },
      ],
    })
    almacen.simularSubida(creado.subidas[0]?.url ?? "", new Uint8Array([1]))

    const resultado = await confirmarMaterial(deps(coni), { materialId: creado.materialId })

    expect(resultado).toEqual({ ok: false, error: "No encontré el archivo que subiste. Inténtalo de nuevo." })
    expect(disparos).toEqual([])
    expect(await fila(creado.materialId)).toBeNull()
  })

  it("discards the material and does not trigger when the file never arrived", async () => {
    const creado = await crearOk(coni, { tipo: "documento", archivos: [{ nombre: "a.pdf", tamano: 4 }] })

    const resultado = await confirmarMaterial(deps(coni), { materialId: creado.materialId })

    expect(resultado).toEqual({ ok: false, error: "No encontré el archivo que subiste. Inténtalo de nuevo." })
    expect(disparos).toEqual([])
    expect(await fila(creado.materialId)).toBeNull()
  })

  it("discards the material when the object in the store is over 2 GB, whatever was declared", async () => {
    const creado = await crearOk(coni, { tipo: "video", archivos: [{ nombre: "a.mp4", tamano: 10 }] })
    almacen.simularSubida(creado.subidas[0]?.url ?? "", { bytes: TAMANO_MAXIMO_BYTES + 1 })

    const resultado = await confirmarMaterial(deps(coni), { materialId: creado.materialId })

    expect(resultado).toEqual({ ok: false, error: "Ese archivo pesa más de 2 GB." })
    expect(disparos).toEqual([])
    expect(await fila(creado.materialId)).toBeNull()
  })

  it("refuses anyone who is neither Coni nor WAV", async () => {
    const creado = await crearOk(coni, { tipo: "link", url: "https://example.com/y", archivos: [] })

    expect(await confirmarMaterial(deps(otra), { materialId: creado.materialId })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    expect(disparos).toEqual([])
  })

  it("does not trigger a material that is not procesando anymore", async () => {
    const creado = await crearOk(coni, { tipo: "link", url: "https://example.com/w", archivos: [] })
    await servicio.from("materiales").update({ estado: "listo" }).eq("id", creado.materialId)

    expect(await confirmarMaterial(deps(coni), { materialId: creado.materialId })).toEqual({ ok: true })
    expect(disparos).toEqual([])
  })

  it("says it did not find a material that does not exist", async () => {
    expect(await confirmarMaterial(deps(coni), { materialId: randomUUID() })).toEqual({
      ok: false,
      error: "No encontré ese material.",
    })
  })

  it("does not understand an id that is not a UUID", async () => {
    expect(await confirmarMaterial(deps(coni), { materialId: "x" })).toEqual({
      ok: false,
      error: "No entendí esa solicitud. Vuelve a abrir la pantalla.",
    })
  })
})

describe("a material belongs to whoever uploaded it", () => {
  it("does not let WAV confirm Coni's material that is still uploading, and keeps Coni's row", async () => {
    const creado = await crearOk(coni, { tipo: "documento", archivos: [{ nombre: "a.pdf", tamano: 4 }] })

    const resultado = await confirmarMaterial(deps(wav), { materialId: creado.materialId })

    expect(resultado).toEqual({ ok: false, error: "No encontré ese material." })
    expect(disparos).toEqual([])
    expect(await fila(creado.materialId)).not.toBeNull()
  })

  it("does not let WAV discard Coni's material, and keeps Coni's row", async () => {
    const creado = await crearOk(coni, { tipo: "documento", archivos: [{ nombre: "a.pdf", tamano: 4 }] })

    await descartarMaterial(deps(wav), { materialId: creado.materialId })

    expect(await fila(creado.materialId)).not.toBeNull()
  })
})

describe("descartarMaterial", () => {
  it("deletes a material that is still procesando", async () => {
    const creado = await crearOk(coni, { tipo: "documento", archivos: [{ nombre: "a.pdf", tamano: 4 }] })

    expect(await descartarMaterial(deps(coni), { materialId: creado.materialId })).toEqual({ ok: true })
    expect(await fila(creado.materialId)).toBeNull()
  })

  it("never deletes a material that is ready", async () => {
    const creado = await crearOk(coni, { tipo: "link", url: "https://example.com/v", archivos: [] })
    await servicio.from("materiales").update({ estado: "listo" }).eq("id", creado.materialId)

    await descartarMaterial(deps(coni), { materialId: creado.materialId })

    expect(await fila(creado.materialId)).not.toBeNull()
  })

  it("refuses anyone who is neither Coni nor WAV", async () => {
    const creado = await crearOk(coni, { tipo: "link", url: "https://example.com/u", archivos: [] })

    expect(await descartarMaterial(deps(otra), { materialId: creado.materialId })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    expect(await fila(creado.materialId)).not.toBeNull()
  })
})

describe("crearCategoria", () => {
  it("calls crear_categoria and answers the new category", async () => {
    const nombre = `${PREFIJO}${randomUUID().slice(0, 6)}`

    const resultado = await crearCategoria(deps(wav), { nombre })

    expect(resultado.ok && resultado.categoria.nombre).toBe(nombre)
    const { data } = await servicio.from("categorias").select("nombre").eq("nombre", nombre)
    expect(data).toHaveLength(1)
  })

  it("answers the existing one when the name was already taken, whatever the accents and case", async () => {
    const primera = await crearCategoria(deps(coni), { nombre: "Bienestar emocional" })
    const repetida = await crearCategoria(deps(coni), { nombre: "  bienestar EMOCIONAL " })

    expect(primera.ok && repetida.ok && repetida.categoria.id === primera.categoria.id).toBe(true)
  })

  it("asks for a name", async () => {
    expect(await crearCategoria(deps(coni), { nombre: "   " })).toEqual({
      ok: false,
      error: "Escribe el nombre de la categoría.",
    })
  })

  it("refuses anyone who is neither Coni nor WAV", async () => {
    expect(await crearCategoria(deps(otra), { nombre: `${PREFIJO}x` })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
  })
})

describe("confirmarMaterial when the run cannot be started", () => {
  it("leaves the material with a reason so it can be retried, instead of procesando forever", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const resultado = await crearOk(coni, { tipo: "link", url: "https://example.com/caido", archivos: [] })

    const confirmado = await confirmarMaterial(
      {
        ...deps(coni),
        disparar: async () => {
          throw new Error("trigger caído")
        },
      },
      { materialId: resultado.materialId },
    )

    expect(confirmado).toMatchObject({ ok: false })
    expect(await fila(resultado.materialId)).toMatchObject({
      estado: "procesando",
      motivo_fallo: "No pude iniciar el procesamiento. Reintenta.",
    })
    vi.restoreAllMocks()
  })
})
