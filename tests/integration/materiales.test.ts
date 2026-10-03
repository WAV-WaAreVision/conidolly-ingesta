import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import {
  autoresDeMateriales,
  borrarMaterial,
  editarFicha,
  leerMaterialConFicha,
  listarMateriales,
  reintentarMaterial,
  urlDeTexto,
} from "@/lib/ingesta/materiales"
import type { DepsSubir } from "@/lib/ingesta/subir"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeOtraPersona, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const creados: string[] = []
const disparos: { id: string; intento: string | undefined }[] = []
const almacen = almacenEnMemoria()
const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."
const PREFIJO = "Prueba de materiales "
const CITAS = [{ texto: "Una cita", ubicacion: { pagina: 4 } }]
const IDEAS = ["uno", "dos", "tres", "cuatro", "cinco"]

let coni: Db
let wav: Db
let otra: Db
let categoriaId: string
let categoriaOtraId: string
let idConi: string
let idWav: string

const deps = (db: Db, extra: Partial<DepsSubir> = {}): DepsSubir => ({
  db,
  almacen,
  disparar: async (id, intento) => {
    disparos.push({ id, intento })
  },
  ahora: () => new Date("2026-10-03T12:00:00.000Z"),
  nuevoId: randomUUID,
  ...extra,
})

async function sembrar(
  extra: Partial<Database["public"]["Tables"]["materiales"]["Insert"]> & {
    subidoPor?: string
    conFicha?: boolean
  } = {},
): Promise<string> {
  const { subidoPor, conFicha, ...columnas } = extra
  const id = randomUUID()
  const { error } = await servicio.from("materiales").insert({
    id,
    tipo: "documento",
    titulo: `${PREFIJO}material`,
    categoria_id: categoriaId,
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: subidoPor ?? idConi,
    estado: "listo",
    idioma_original: "en",
    ...columnas,
  })
  if (error) throw new Error(error.message)
  creados.push(id)
  if (conFicha ?? columnas.estado === undefined) {
    const ficha = await servicio.from("fichas").insert({
      material_id: id,
      resumen: "Resumen original",
      ideas_clave: IDEAS,
      citas: CITAS,
      fuente: { autor: "Perel", anio: 2017, enlace: null },
    })
    if (ficha.error) throw new Error(ficha.error.message)
  }
  return id
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
  const otraCategoria = await servicio
    .from("categorias")
    .insert({ slug: "prueba-materiales", nombre: `${PREFIJO}categoria` })
    .select("id")
    .single()
  if (otraCategoria.error) throw new Error(otraCategoria.error.message)
  categoriaOtraId = otraCategoria.data.id
  idConi = (await coni.auth.getUser()).data.user?.id ?? ""
  idWav = (await wav.auth.getUser()).data.user?.id ?? ""
})

afterEach(async () => {
  disparos.length = 0
  vi.restoreAllMocks()
  if (creados.length > 0) await servicio.from("materiales").delete().in("id", creados.splice(0))
})

afterAll(async () => {
  await servicio.from("categorias").delete().like("nombre", `${PREFIJO}%`)
})

describe("listarMateriales", () => {
  it("filters by category, author, type and state, and names the category", async () => {
    const a = await sembrar({ titulo: `${PREFIJO}a`, autor: "Perel", tipo: "audio", estado: "listo" })
    const b = await sembrar({
      titulo: `${PREFIJO}b`,
      autor: "Brown",
      tipo: "audio",
      estado: "fallido",
      motivo_fallo: "x",
    })
    const c = await sembrar({ titulo: `${PREFIJO}c`, autor: "Perel", tipo: "video", categoria_id: categoriaOtraId })
    const ids = async (filtros: Parameters<typeof listarMateriales>[1]) =>
      (await listarMateriales(coni, filtros))
        .filter((m) => [a, b, c].includes(m.id))
        .map((m) => m.id)
        .sort()

    expect(await ids({})).toEqual([a, b, c].sort())
    expect(await ids({ categoria: categoriaOtraId })).toEqual([c])
    expect(await ids({ autor: "Perel" })).toEqual([a, c].sort())
    expect(await ids({ tipo: "audio" })).toEqual([a, b].sort())
    expect(await ids({ estado: "fallido" })).toEqual([b])
    expect(await ids({ autor: "Perel", tipo: "audio" })).toEqual([a])
    const lista = await listarMateriales(coni, { categoria: categoriaOtraId })
    expect(lista.find((m) => m.id === c)).toMatchObject({ titulo: `${PREFIJO}c`, categoria: `${PREFIJO}categoria` })
  })

  it("lists the distinct authors, without blanks", async () => {
    await sembrar({ autor: "Zeta Autora" })
    await sembrar({ autor: "Zeta Autora" })
    await sembrar({ autor: null })

    const autores = await autoresDeMateriales(coni)

    expect(autores.filter((autor) => autor === "Zeta Autora")).toHaveLength(1)
    expect(autores).not.toContain("")
  })
})

describe("leerMaterialConFicha", () => {
  it("reads the material with its category and its card", async () => {
    const id = await sembrar({ autor: "Perel" })

    const leido = await leerMaterialConFicha(coni, id)

    expect(leido?.material).toMatchObject({ id, estado: "listo", idioma_original: "en", categoria: "General" })
    expect(leido?.ficha).toMatchObject({ resumen: "Resumen original", ideasClave: IDEAS, citas: CITAS })
  })

  it("is null for a material that does not exist and a null card while it has none", async () => {
    expect(await leerMaterialConFicha(coni, randomUUID())).toBeNull()
    const id = await sembrar({ estado: "procesando" })
    expect((await leerMaterialConFicha(coni, id))?.ficha).toBeNull()
  })
})

describe("reintentarMaterial", () => {
  it("as Coni, puts a failed material back to procesando and starts a new run with its own attempt key", async () => {
    const id = await sembrar({ estado: "fallido", motivo_fallo: "El PDF no tiene texto." })

    const resultado = await reintentarMaterial(deps(coni, { nuevoId: () => "intento-uno" }), { materialId: id })

    expect(resultado).toEqual({ ok: true })
    expect(await fila(id)).toMatchObject({ estado: "procesando", motivo_fallo: null })
    expect(disparos).toEqual([{ id, intento: "intento-uno" }])
  })

  it("retries a material the monthly cap stopped", async () => {
    const id = await sembrar({ estado: "procesando", motivo_fallo: "Llegaste al tope de gasto." })

    expect(await reintentarMaterial(deps(wav), { materialId: id })).toEqual({ ok: true })

    expect((await fila(id))?.motivo_fallo).toBeNull()
    expect(disparos).toHaveLength(1)
  })

  it("starts nothing for a material that is not retryable, so a double tap runs once", async () => {
    const id = await sembrar({ estado: "fallido", motivo_fallo: "x" })
    await reintentarMaterial(deps(coni), { materialId: id })

    const segundo = await reintentarMaterial(deps(coni), { materialId: id })

    expect(segundo).toEqual({ ok: false, error: "Ese material ya no se puede reintentar." })
    expect(disparos).toHaveLength(1)
  })

  it("refuses anyone who is neither Coni nor WAV, and changes nothing", async () => {
    const id = await sembrar({ estado: "fallido", motivo_fallo: "x" })

    expect(await reintentarMaterial(deps(otra), { materialId: id })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    expect((await fila(id))?.estado).toBe("fallido")
    expect(disparos).toEqual([])
  })

  it("refuses an id that is not a UUID", async () => {
    expect(await reintentarMaterial(deps(coni), { materialId: "no" })).toMatchObject({ ok: false })
    expect(disparos).toEqual([])
  })

  it("says so, and logs, when the run could not be started after the state was reset", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const id = await sembrar({ estado: "fallido", motivo_fallo: "x" })

    const resultado = await reintentarMaterial(
      deps(coni, {
        disparar: async () => {
          throw new Error("trigger caído")
        },
      }),
      { materialId: id },
    )

    expect(resultado).toMatchObject({ ok: false, error: expect.stringContaining("no pude iniciar") })
    expect(error).toHaveBeenCalledWith(expect.stringContaining(id), expect.any(Error))
  })
})

describe("editarFicha", () => {
  const edicion = (materialId: string, extra: Record<string, unknown> = {}) => ({
    materialId,
    resumen: "Resumen editado",
    ideasClave: ["a", "b", "c", "d", "e", "f"],
    citas: [{ texto: "Cita editada", ubicacion: { segundo: 61, pista: "voz" } }],
    fuente: { autor: "Esther Perel", anio: 2018, enlace: "https://example.com/x" },
    ...extra,
  })

  it.each([
    ["Coni", () => coni, () => idConi],
    ["WAV", () => wav, () => idWav],
  ])("lets %s edit the card, which records who did", async (_n, cliente, quien) => {
    const id = await sembrar()

    expect(await editarFicha(deps(cliente()), edicion(id))).toEqual({ ok: true })

    const { data } = await servicio.from("fichas").select("*").eq("material_id", id).single()
    expect(data).toMatchObject({
      resumen: "Resumen editado",
      ideas_clave: ["a", "b", "c", "d", "e", "f"],
      citas: [{ texto: "Cita editada", ubicacion: { segundo: 61, pista: "voz" } }],
      fuente: { autor: "Esther Perel", anio: 2018, enlace: "https://example.com/x" },
      editada_por: quien(),
    })
  })

  it("refuses fewer than five key ideas and leaves the card as it was", async () => {
    const id = await sembrar()

    expect(await editarFicha(deps(coni), edicion(id, { ideasClave: ["a"] }))).toEqual({
      ok: false,
      error: "Deja entre 5 y 10 ideas clave.",
    })
    const { data } = await servicio.from("fichas").select("resumen").eq("material_id", id).single()
    expect(data?.resumen).toBe("Resumen original")
  })

  it("refuses anyone who is neither Coni nor WAV", async () => {
    const id = await sembrar()

    expect(await editarFicha(deps(otra), edicion(id))).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
  })

  it("says the material has no card when there is nothing to edit", async () => {
    const id = await sembrar({ estado: "procesando" })

    expect(await editarFicha(deps(coni), edicion(id))).toEqual({
      ok: false,
      error: "Ese material todavía no tiene ficha.",
    })
  })
})

describe("borrarMaterial", () => {
  async function conObjetos(id: string) {
    almacen.poner(`materiales/${id}/texto.txt`, new Uint8Array([1]), "text/plain")
    almacen.poner(`materiales/${id}/texto-original.txt`, new Uint8Array([1]), "text/plain")
  }

  it("as Coni, deletes someone else's material, its card and its stored files", async () => {
    const id = await sembrar({ subidoPor: idWav })
    await conObjetos(id)

    expect(await borrarMaterial(deps(coni), { materialId: id })).toEqual({ ok: true })

    expect(await fila(id)).toBeNull()
    expect((await servicio.from("fichas").select("material_id").eq("material_id", id)).data).toEqual([])
    expect(almacen.claves().filter((clave) => clave.includes(id))).toEqual([])
  })

  it("lets WAV delete what WAV uploaded", async () => {
    const id = await sembrar({ subidoPor: idWav })

    expect(await borrarMaterial(deps(wav), { materialId: id })).toEqual({ ok: true })
    expect(await fila(id)).toBeNull()
  })

  it("does not let WAV delete what Coni uploaded: nothing is deleted, files included", async () => {
    const id = await sembrar({ subidoPor: idConi })
    await conObjetos(id)

    const resultado = await borrarMaterial(deps(wav), { materialId: id })

    expect(resultado).toEqual({ ok: false, error: "Solo Coni o quien lo subió puede borrarlo." })
    expect(await fila(id)).not.toBeNull()
    expect(almacen.claves().filter((clave) => clave.includes(id))).toHaveLength(2)
  })

  it("refuses anyone who is neither Coni nor WAV", async () => {
    const id = await sembrar()

    expect(await borrarMaterial(deps(otra), { materialId: id })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    expect(await fila(id)).not.toBeNull()
  })

  it("says it was not found for a material that does not exist", async () => {
    expect(await borrarMaterial(deps(coni), { materialId: randomUUID() })).toEqual({
      ok: false,
      error: "No encontré ese material.",
    })
  })

  it("still succeeds when the stored files cannot be deleted, and logs it explicitly for the sweep", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const id = await sembrar()
    const fallido = {
      ...almacen,
      borrarCarpeta: async () => {
        throw new Error("R2 caído")
      },
    }

    const resultado = await borrarMaterial(deps(coni, { almacen: fallido }), { materialId: id })

    expect(resultado).toEqual({ ok: true })
    expect(await fila(id)).toBeNull()
    expect(error).toHaveBeenCalledWith(expect.stringContaining(`materiales/${id}/`), expect.any(Error))
  })
})

describe("urlDeTexto", () => {
  it.each([
    ["traducido", `materiales/ID/texto.txt`, "texto.txt"],
    ["original", `materiales/ID/texto-original.txt`, "texto-original.txt"],
  ] as const)("signs a short download of the %s text", async (cual, plantilla, nombre) => {
    const id = await sembrar()
    const clave = plantilla.replace("ID", id)
    almacen.poner(clave, new Uint8Array([1]), "text/plain")

    const resultado = await urlDeTexto(deps(coni), { materialId: id, cual })

    expect(resultado).toEqual({ ok: true, url: `https://almacen.test/${clave}?expira=300&descarga=${nombre}` })
  })

  it("says the text is not ready when the file is not there", async () => {
    const id = await sembrar()

    expect(await urlDeTexto(deps(coni), { materialId: id, cual: "original" })).toEqual({
      ok: false,
      error: "Ese texto todavía no está disponible.",
    })
  })

  it("refuses anyone who is neither Coni nor WAV, and anything but the two texts", async () => {
    const id = await sembrar()
    almacen.poner(`materiales/${id}/texto.txt`, new Uint8Array([1]), "text/plain")

    expect(await urlDeTexto(deps(otra), { materialId: id, cual: "traducido" })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    expect(await urlDeTexto(deps(coni), { materialId: id, cual: "ficha" })).toMatchObject({ ok: false })
  })
})
