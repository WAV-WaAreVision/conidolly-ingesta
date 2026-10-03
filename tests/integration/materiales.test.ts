import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import {
  borrarMaterial,
  confirmarCosto,
  editarFicha,
  editarMaterial,
  leerMapaDelMaterial,
  leerMaterialConFicha,
  listarMateriales,
  reintentarMaterial,
  reprocesarMaterial,
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
let autorId: string
let autorOtroId: string
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
    autor_id: autorId,
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

async function sembrarAutor(nombre: string): Promise<string> {
  const { data, error } = await servicio
    .from("autores")
    .insert({ nombre: `${PREFIJO}${nombre} ${randomUUID().slice(0, 6)}`, tipo: "persona" })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

const VECTOR_NULO = `[${new Array(1024).fill(0).join(",")}]`

async function sembrarTema(nombre: string): Promise<string> {
  const { data, error } = await servicio
    .from("temas")
    .insert({ nombre: `${PREFIJO}${nombre} ${randomUUID().slice(0, 6)}`, centroide: VECTOR_NULO })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function sembrarAfirmacion(
  materialId: string,
  extra: Partial<Database["public"]["Tables"]["afirmaciones"]["Insert"]> = {},
) {
  const { error } = await servicio.from("afirmaciones").insert({
    material_id: materialId,
    autor_id: autorId,
    tramo: 0,
    ubicacion: { pagina: 1 },
    texto: "El deseo cambia con los años.",
    cita: "El deseo cambia con los años, dijo ella.",
    tipo: "dato",
    evidencia: "opinion",
    ...extra,
  })
  if (error) throw new Error(error.message)
}

async function fila(id: string) {
  const { data, error } = await servicio.from("materiales").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

beforeAll(async () => {
  ;[coni, wav, otra] = await Promise.all([clienteDeConi(), clienteDeWav(), clienteDeOtraPersona()])
  autorId = await sembrarAutor("Perel")
  autorOtroId = await sembrarAutor("Brown")
  idConi = (await coni.auth.getUser()).data.user?.id ?? ""
  idWav = (await wav.auth.getUser()).data.user?.id ?? ""
})

afterEach(async () => {
  disparos.length = 0
  vi.restoreAllMocks()
  if (creados.length > 0) await servicio.from("materiales").delete().in("id", creados.splice(0))
})

afterAll(async () => {
  await servicio.from("temas").delete().like("nombre", `${PREFIJO}%`)
  await servicio.from("autores").delete().like("nombre", `${PREFIJO}%`)
})

describe("listarMateriales", () => {
  it("filters by author, role, type and state, and names the author", async () => {
    const a = await sembrar({ titulo: `${PREFIJO}a`, tipo: "audio", estado: "listo", rol: "voz_propia" })
    const b = await sembrar({
      titulo: `${PREFIJO}b`,
      autor_id: autorOtroId,
      tipo: "audio",
      estado: "fallido",
      motivo_fallo: "x",
    })
    const c = await sembrar({ titulo: `${PREFIJO}c`, tipo: "video", rol: "evidencia" })
    const ids = async (filtros: Parameters<typeof listarMateriales>[1]) =>
      (await listarMateriales(coni, filtros))
        .filter((m) => [a, b, c].includes(m.id))
        .map((m) => m.id)
        .sort()

    expect(await ids({})).toEqual([a, b, c].sort())
    expect(await ids({ autor: autorOtroId })).toEqual([b])
    expect(await ids({ autor: autorId })).toEqual([a, c].sort())
    expect(await ids({ rol: "evidencia" })).toEqual([c])
    expect(await ids({ tipo: "audio" })).toEqual([a, b].sort())
    expect(await ids({ estado: "fallido" })).toEqual([b])
    expect(await ids({ autor: autorId, tipo: "audio" })).toEqual([a])
    const lista = await listarMateriales(coni, { rol: "voz_propia" })
    expect(lista.find((m) => m.id === a)).toMatchObject({
      titulo: `${PREFIJO}a`,
      autor_id: autorId,
      autor: expect.stringContaining("Perel"),
      rol: "voz_propia",
    })
  })
})

describe("leerMaterialConFicha", () => {
  it("reads the material with its author, its role and its card", async () => {
    const id = await sembrar({ rol: "estrategia" })

    const leido = await leerMaterialConFicha(coni, id)

    expect(leido?.material).toMatchObject({
      id,
      estado: "listo",
      idioma_original: "en",
      autor_id: autorId,
      autor: expect.stringContaining("Perel"),
      rol: "estrategia",
    })
    expect(leido?.ficha).toMatchObject({ resumen: "Resumen original", ideasClave: IDEAS, citas: CITAS })
  })

  it("is null for a material that does not exist and a null card while it has none", async () => {
    expect(await leerMaterialConFicha(coni, randomUUID())).toBeNull()
    const id = await sembrar({ estado: "procesando" })
    expect((await leerMaterialConFicha(coni, id))?.ficha).toBeNull()
  })
})

describe("leerMapaDelMaterial", () => {
  it("counts the claims by topic, by type and by evidence, leaving out the excluded ones", async () => {
    const id = await sembrar({ conFicha: false })
    const apego = await sembrarTema("Apego")
    const deseo = await sembrarTema("Deseo")
    await sembrarAfirmacion(id, { tema_id: apego, tipo: "definicion", evidencia: "estudio" })
    await sembrarAfirmacion(id, { tema_id: apego, tipo: "consejo", evidencia: "clinica" })
    await sembrarAfirmacion(id, { tema_id: apego, tipo: "consejo", evidencia: "clinica" })
    await sembrarAfirmacion(id, { tema_id: deseo, tipo: "mito", evidencia: "opinion" })
    await sembrarAfirmacion(id, { tema_id: null, tipo: "dato", evidencia: "estudio" })
    await sembrarAfirmacion(id, { tema_id: null, tipo: "dato", evidencia: "estudio", excluida: true })

    const mapa = await leerMapaDelMaterial(coni, id)

    expect(mapa.total).toBe(5)
    expect(mapa.temas.map((tema) => [tema.id, tema.afirmaciones])).toEqual([
      [apego, 3],
      [deseo, 1],
    ])
    expect(mapa.temas[0]?.nombre).toContain("Apego")
    expect(mapa.sinTema).toBe(1)
    expect(mapa.tipos).toEqual({ definicion: 1, consejo: 2, mito: 1, dato: 1 })
    expect(mapa.evidencia).toEqual({ estudio: 2, clinica: 2, opinion: 1 })
  })

  it("reads every claim of a material, not just the first thousand", async () => {
    const id = await sembrar({ conFicha: false })
    const { error } = await servicio.from("afirmaciones").insert(
      Array.from({ length: 1205 }, (_, tramo) => ({
        material_id: id,
        autor_id: autorId,
        tramo,
        ubicacion: { pagina: tramo },
        texto: `Afirmación ${tramo}`,
        cita: `Cita ${tramo}`,
        tipo: "dato",
        evidencia: "opinion",
      })),
    )
    if (error) throw new Error(error.message)

    expect((await leerMapaDelMaterial(coni, id)).total).toBe(1205)
  })

  it("is empty for a material without claims", async () => {
    const id = await sembrar({ conFicha: false })

    expect(await leerMapaDelMaterial(coni, id)).toEqual({ total: 0, temas: [], sinTema: 0, tipos: {}, evidencia: {} })
  })
})

describe("editarMaterial", () => {
  it("changes the author and the role of a material, as Coni or as WAV", async () => {
    const id = await sembrar()

    expect(await editarMaterial(deps(coni), { materialId: id, autorId: autorOtroId, rol: "evidencia" })).toEqual({
      ok: true,
    })
    expect(await fila(id)).toMatchObject({ autor_id: autorOtroId, rol: "evidencia" })
    expect(await editarMaterial(deps(wav), { materialId: id, autorId, rol: "voz_propia" })).toEqual({ ok: true })
    expect(await fila(id)).toMatchObject({ autor_id: autorId, rol: "voz_propia" })
  })

  it("refuses anyone who is neither Coni nor WAV, and changes nothing", async () => {
    const id = await sembrar()

    expect(await editarMaterial(deps(otra), { materialId: id, autorId: autorOtroId, rol: "evidencia" })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    expect(await fila(id)).toMatchObject({ autor_id: autorId, rol: "referente" })
  })

  it("refuses an author or a role that is not valid", async () => {
    const id = await sembrar()

    expect(await editarMaterial(deps(coni), { materialId: id, autorId: "x", rol: "referente" })).toEqual({
      ok: false,
      error: "Elige el autor.",
    })
    expect(await editarMaterial(deps(coni), { materialId: id, autorId, rol: "jefa" })).toEqual({
      ok: false,
      error: "Elige qué papel cumple este material.",
    })
  })

  it("says the author is gone when it does not exist anymore", async () => {
    const id = await sembrar()

    expect(await editarMaterial(deps(coni), { materialId: id, autorId: randomUUID(), rol: "referente" })).toEqual({
      ok: false,
      error: "Ese autor ya no existe. Elígelo de nuevo.",
    })
  })

  it("says it did not find a material that does not exist", async () => {
    expect(await editarMaterial(deps(coni), { materialId: randomUUID(), autorId, rol: "referente" })).toEqual({
      ok: false,
      error: "No encontré ese material.",
    })
  })
})

describe("reprocesarMaterial", () => {
  it("sends a ready material back to procesando, drops its claims and starts a run with its own attempt key", async () => {
    const id = await sembrar({ conFicha: false, rol: "referente" })
    await sembrarAfirmacion(id)
    await sembrarAfirmacion(id)

    const resultado = await reprocesarMaterial(deps(coni, { nuevoId: () => "intento-dos" }), { materialId: id })

    expect(resultado).toEqual({ ok: true })
    expect(await fila(id)).toMatchObject({ estado: "procesando", motivo_fallo: null, costo_confirmado_en: null })
    expect((await leerMapaDelMaterial(coni, id)).total).toBe(0)
    expect(disparos).toEqual([{ id, intento: "intento-dos" }])
  })

  it("lets WAV reprocess too", async () => {
    const id = await sembrar({ conFicha: false })

    expect(await reprocesarMaterial(deps(wav), { materialId: id })).toEqual({ ok: true })
    expect(disparos).toHaveLength(1)
  })

  it("starts one run for a double tap, because only a ready material can be reprocessed", async () => {
    const id = await sembrar({ conFicha: false })
    await reprocesarMaterial(deps(coni), { materialId: id })

    expect(await reprocesarMaterial(deps(coni), { materialId: id })).toEqual({
      ok: false,
      error: "Ese material no se puede reprocesar ahora.",
    })
    expect(disparos).toHaveLength(1)
  })

  it("does not reprocess a material that is still processing or failed", async () => {
    const procesando = await sembrar({ estado: "procesando" })
    const fallido = await sembrar({ estado: "fallido", motivo_fallo: "x" })

    for (const id of [procesando, fallido]) {
      expect(await reprocesarMaterial(deps(coni), { materialId: id })).toEqual({
        ok: false,
        error: "Ese material no se puede reprocesar ahora.",
      })
    }
    expect(disparos).toEqual([])
  })

  it("refuses anyone who is neither Coni nor WAV, and changes nothing", async () => {
    const id = await sembrar({ conFicha: false })
    await sembrarAfirmacion(id)

    expect(await reprocesarMaterial(deps(otra), { materialId: id })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    expect((await fila(id))?.estado).toBe("listo")
    expect((await leerMapaDelMaterial(coni, id)).total).toBe(1)
    expect(disparos).toEqual([])
  })

  it("refuses an id that is not a UUID", async () => {
    expect(await reprocesarMaterial(deps(coni), { materialId: "no" })).toMatchObject({ ok: false })
    expect(disparos).toEqual([])
  })

  it("leaves the material retryable, with a reason, when the run could not be started", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const id = await sembrar({ conFicha: false })

    const resultado = await reprocesarMaterial(
      deps(coni, {
        disparar: async () => {
          throw new Error("trigger caído")
        },
      }),
      { materialId: id },
    )

    expect(resultado).toEqual({ ok: false, error: "No pude iniciar el procesamiento. Toca Reintentar en un rato." })
    expect(await fila(id)).toMatchObject({
      estado: "procesando",
      motivo_fallo: "No pude iniciar el procesamiento. Reintenta.",
    })
    expect(error).toHaveBeenCalled()
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

    expect(resultado).toMatchObject({ ok: false, error: expect.stringContaining("No pude iniciar el procesamiento") })
    expect(error).toHaveBeenCalledWith(expect.stringContaining(id), expect.any(Error))
    // It does not stay procesando forever: it carries a reason, so it stops polling and can be retried again.
    expect(await fila(id)).toMatchObject({
      estado: "procesando",
      motivo_fallo: "No pude iniciar el procesamiento. Reintenta.",
    })
    expect(await reintentarMaterial(deps(coni), { materialId: id })).toEqual({ ok: true })
    expect(disparos).toHaveLength(1)
  })
})

describe("confirmarCosto", () => {
  const esperando = (extra: Partial<Database["public"]["Tables"]["materiales"]["Insert"]> = {}) =>
    sembrar({
      estado: "procesando",
      motivo_fallo: "Este material es largo: procesarlo cuesta cerca de US$ 0,80. Confírmalo para seguir.",
      costo_estimado_usd: 0.8,
      ...extra,
    })

  it("as Coni, confirms the cost, clears the reason and starts a run with its own attempt key", async () => {
    const id = await esperando()

    const resultado = await confirmarCosto(deps(coni, { nuevoId: () => "intento-costo" }), { materialId: id })

    expect(resultado).toEqual({ ok: true })
    const material = await fila(id)
    expect(material).toMatchObject({ estado: "procesando", motivo_fallo: null })
    expect(material?.costo_confirmado_en).not.toBeNull()
    expect(disparos).toEqual([{ id, intento: "intento-costo" }])
  })

  it("lets WAV confirm too", async () => {
    const id = await esperando()

    expect(await confirmarCosto(deps(wav), { materialId: id })).toEqual({ ok: true })
  })

  it("starts one run for a double tap", async () => {
    const id = await esperando()
    await confirmarCosto(deps(coni), { materialId: id })

    const segundo = await confirmarCosto(deps(coni), { materialId: id })

    expect(segundo).toEqual({ ok: false, error: "Ese material ya no espera confirmación." })
    expect(disparos).toHaveLength(1)
  })

  it("refuses a material that never had an estimate, and starts nothing", async () => {
    const id = await sembrar({ estado: "fallido", motivo_fallo: "x" })

    expect(await confirmarCosto(deps(coni), { materialId: id })).toEqual({
      ok: false,
      error: "Ese material ya no espera confirmación.",
    })
    expect(disparos).toEqual([])
  })

  it("refuses anyone who is neither Coni nor WAV, and changes nothing", async () => {
    const id = await esperando()

    expect(await confirmarCosto(deps(otra), { materialId: id })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    expect((await fila(id))?.costo_confirmado_en).toBeNull()
    expect(disparos).toEqual([])
  })

  it("refuses an id that is not a UUID", async () => {
    expect(await confirmarCosto(deps(coni), { materialId: "no" })).toMatchObject({ ok: false })
    expect(disparos).toEqual([])
  })

  it("says so, and leaves it retryable, when the run could not be started after confirming", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const id = await esperando()

    const resultado = await confirmarCosto(
      deps(coni, {
        disparar: async () => {
          throw new Error("trigger caído")
        },
      }),
      { materialId: id },
    )

    expect(resultado).toMatchObject({ ok: false, error: expect.stringContaining("No pude iniciar el procesamiento") })
    expect(error).toHaveBeenCalledWith(expect.stringContaining(id), expect.any(Error))
    expect(await fila(id)).toMatchObject({
      estado: "procesando",
      motivo_fallo: "No pude iniciar el procesamiento. Reintenta.",
    })
    expect(await reintentarMaterial(deps(coni), { materialId: id })).toEqual({ ok: true })
  })

  it("lists and reads the estimate with the material", async () => {
    const id = await esperando()

    const lista = await listarMateriales(coni, {})
    expect(lista.find((m) => m.id === id)).toMatchObject({ costo_estimado_usd: 0.8, costo_confirmado_en: null })
    const leido = await leerMaterialConFicha(coni, id)
    expect(leido?.material).toMatchObject({ costo_estimado_usd: 0.8, costo_confirmado_en: null })
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
  it("signs a short download of the original text", async () => {
    const id = await sembrar()
    const clave = `materiales/${id}/texto-original.txt`
    almacen.poner(clave, new Uint8Array([1]), "text/plain")

    const resultado = await urlDeTexto(deps(coni), { materialId: id })

    expect(resultado).toEqual({ ok: true, url: `https://almacen.test/${clave}?expira=300&descarga=texto-original.txt` })
  })

  it("says the text is not ready when the file is not there", async () => {
    const id = await sembrar()

    expect(await urlDeTexto(deps(coni), { materialId: id })).toEqual({
      ok: false,
      error: "Ese texto todavía no está disponible.",
    })
  })

  it("never signs the translated text, which no run produces any more", async () => {
    const id = await sembrar()
    almacen.poner(`materiales/${id}/texto.txt`, new Uint8Array([1]), "text/plain")

    expect(await urlDeTexto(deps(coni), { materialId: id, cual: "traducido" })).toEqual({
      ok: false,
      error: "Ese texto todavía no está disponible.",
    })
  })

  it("refuses anyone who is neither Coni nor WAV", async () => {
    const id = await sembrar()
    almacen.poner(`materiales/${id}/texto-original.txt`, new Uint8Array([1]), "text/plain")

    expect(await urlDeTexto(deps(otra), { materialId: id })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
  })
})
