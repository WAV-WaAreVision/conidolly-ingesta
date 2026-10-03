import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import type { DepsSubir } from "@/lib/ingesta/subir"
import {
  guardarTeoria,
  leerTeoria,
  listarTeorias,
  pedirTeoria,
  reintentarTeoria,
  teoriasDelGrafo,
} from "@/lib/ingesta/teorias"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeOtraPersona, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."
const PREFIJO = "Prueba de teorias "
const materiales: string[] = []
const teorias: string[] = []

let coni: Db
let wav: Db
let otra: Db
let categoriaId: string
let idConi: string
let disparos: { id: string; intento: string | undefined }[] = []

const deps = (db: Db, extra: Partial<DepsSubir> = {}): DepsSubir => ({
  db,
  almacen: almacenEnMemoria(),
  disparar: async () => {},
  dispararTeoria: async (id, intento) => {
    disparos.push({ id, intento })
  },
  ahora: () => new Date("2026-10-03T12:00:00.000Z"),
  nuevoId: randomUUID,
  ...extra,
})

async function material(extra: { estado?: string; conFicha?: boolean } = {}): Promise<string> {
  const id = randomUUID()
  const { error } = await servicio.from("materiales").insert({
    id,
    tipo: "documento",
    titulo: `${PREFIJO}${id.slice(0, 6)}`,
    categoria_id: categoriaId,
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: idConi,
    estado: extra.estado ?? "listo",
  })
  if (error) throw new Error(error.message)
  materiales.push(id)
  if (extra.conFicha ?? true) {
    const ficha = await servicio
      .from("fichas")
      .insert({ material_id: id, resumen: "r", ideas_clave: [], citas: [], fuente: {} })
    if (ficha.error) throw new Error(ficha.error.message)
  }
  return id
}

async function dosMateriales(): Promise<[string, string]> {
  return [await material(), await material()]
}

async function pedida(db: Db = coni): Promise<{ teoriaId: string; ids: [string, string] }> {
  const ids = await dosMateriales()
  const resultado = await pedirTeoria(deps(db), { materialIds: ids })
  if (!resultado.ok) throw new Error(resultado.error)
  teorias.push(resultado.teoriaId)
  return { teoriaId: resultado.teoriaId, ids }
}

async function conBorrador(): Promise<{ teoriaId: string; ids: [string, string] }> {
  const { teoriaId, ids } = await pedida()
  const argumentos = [{ materialId: ids[0], aporte: "Aporta.", cita: "Una cita.", ubicacion: "resumen" }]
  const { error } = await servicio
    .from("teorias")
    .update({ titulo: "Título", tesis: "Tesis.", argumentos, contradicciones: [], estado: "borrador" })
    .eq("id", teoriaId)
  if (error) throw new Error(error.message)
  disparos = []
  return { teoriaId, ids }
}

const estadoDe = async (id: string) =>
  (await servicio.from("teorias").select("estado, motivo_fallo, titulo, tesis, argumentos").eq("id", id).single()).data

beforeAll(async () => {
  ;[coni, wav, otra] = await Promise.all([clienteDeConi(), clienteDeWav(), clienteDeOtraPersona()])
  categoriaId = (await servicio.from("categorias").select("id").eq("slug", "general").single()).data?.id ?? ""
  const { data } = await servicio.auth.admin.listUsers()
  idConi = data.users.find((u) => u.email === "coni@estudio.test")?.id ?? ""
})

afterAll(async () => {
  await servicio.from("teorias").delete().in("id", teorias)
  await servicio.from("materiales").delete().in("id", materiales)
})

describe("pedirTeoria", () => {
  it("creates the theory, starts the synthesis once and answers its id", async () => {
    disparos = []
    const ids = await dosMateriales()

    const resultado = await pedirTeoria(deps(coni), { materialIds: ids })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    teorias.push(resultado.teoriaId)
    expect((await estadoDe(resultado.teoriaId))?.estado).toBe("sintetizando")
    expect(disparos).toEqual([{ id: resultado.teoriaId, intento: undefined }])
    const fuentes = await servicio.from("teoria_fuentes").select("material_id").eq("teoria_id", resultado.teoriaId)
    expect(fuentes.data?.map((f) => f.material_id).sort()).toEqual([...ids].sort())
  })

  it("lets WAV ask for one too", async () => {
    const { teoriaId } = await pedida(wav)

    const { data } = await servicio.from("teorias").select("creada_por").eq("id", teoriaId).single()
    expect(data?.creada_por).not.toBe(idConi)
  })

  it("refuses someone who is neither Coni nor WAV, and starts nothing", async () => {
    disparos = []
    const ids = await dosMateriales()

    const resultado = await pedirTeoria(deps(otra), { materialIds: ids })

    expect(resultado).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    expect(disparos).toEqual([])
  })

  it("asks for between two and eight different materials, and starts nothing otherwise", async () => {
    disparos = []
    const uno = await material()
    const nueve = await Promise.all(Array.from({ length: 9 }, () => material()))

    for (const materialIds of [[uno], [uno, uno], nueve, "nada", undefined]) {
      const resultado = await pedirTeoria(deps(coni), { materialIds })
      expect(resultado).toEqual({ ok: false, error: "Elige entre 2 y 8 materiales para armar una teoría." })
    }
    expect(disparos).toEqual([])
  })

  it("explains that only ready materials with a card can be used", async () => {
    disparos = []
    const buena = await material()
    const procesando = await material({ estado: "procesando", conFicha: false })

    const resultado = await pedirTeoria(deps(coni), { materialIds: [buena, procesando] })

    expect(resultado).toEqual({ ok: false, error: "Solo se pueden usar materiales listos y con ficha." })
    expect(disparos).toEqual([])
  })

  it("marks the theory fallida, with a reason, when the run cannot start", async () => {
    const ids = await dosMateriales()
    const dispararTeoria = async () => {
      throw new Error("sin Trigger.dev")
    }

    const resultado = await pedirTeoria(deps(coni, { dispararTeoria }), { materialIds: ids })

    expect(resultado.ok).toBe(false)
    const { data } = await servicio.from("teoria_fuentes").select("teoria_id").eq("material_id", ids[0])
    const teoriaId = data?.[0]?.teoria_id ?? ""
    teorias.push(teoriaId)
    expect(await estadoDe(teoriaId)).toMatchObject({
      estado: "fallida",
      motivo_fallo: "No pude iniciar la síntesis. Reintenta.",
    })
  })
})

describe("reintentarTeoria", () => {
  async function fallida(): Promise<string> {
    const { teoriaId } = await pedida()
    await servicio.from("teorias").update({ estado: "fallida", motivo_fallo: "No salió" }).eq("id", teoriaId)
    disparos = []
    return teoriaId
  }

  it("puts a failed theory back to work and starts a new run under an attempt key of its own", async () => {
    const teoriaId = await fallida()

    const resultado = await reintentarTeoria(deps(coni, { nuevoId: () => "intento-uno" }), { teoriaId })

    expect(resultado).toEqual({ ok: true })
    expect(await estadoDe(teoriaId)).toMatchObject({ estado: "sintetizando", motivo_fallo: null })
    expect(disparos).toEqual([{ id: teoriaId, intento: "intento-uno" }])
  })

  it("refuses a theory that did not fail", async () => {
    const { teoriaId } = await pedida()
    disparos = []

    const resultado = await reintentarTeoria(deps(coni), { teoriaId })

    expect(resultado).toEqual({ ok: false, error: "Esa teoría ya no se puede reintentar." })
    expect(disparos).toEqual([])
  })

  it("leaves it fallida again when the run cannot start", async () => {
    const teoriaId = await fallida()
    const dispararTeoria = async () => {
      throw new Error("sin Trigger.dev")
    }

    const resultado = await reintentarTeoria(deps(coni, { dispararTeoria }), { teoriaId })

    expect(resultado.ok).toBe(false)
    expect((await estadoDe(teoriaId))?.estado).toBe("fallida")
  })

  it("refuses someone who is neither Coni nor WAV", async () => {
    const teoriaId = await fallida()

    expect(await reintentarTeoria(deps(otra), { teoriaId })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
  })
})

describe("guardarTeoria", () => {
  it("saves the title, the thesis and the category, keeps the synthesis as it was and leaves it guardada", async () => {
    const { teoriaId } = await conBorrador()
    const antes = (await estadoDe(teoriaId))?.argumentos

    const resultado = await guardarTeoria(deps(wav), {
      teoriaId,
      titulo: "  Mi título ",
      tesis: "Mi tesis editada.",
      categoriaId,
    })

    expect(resultado).toEqual({ ok: true })
    expect(await estadoDe(teoriaId)).toMatchObject({
      estado: "guardada",
      titulo: "Mi título",
      tesis: "Mi tesis editada.",
    })
    expect((await estadoDe(teoriaId))?.argumentos).toEqual(antes)
  })

  it("asks for a title and a thesis", async () => {
    const { teoriaId } = await conBorrador()

    const resultado = await guardarTeoria(deps(coni), { teoriaId, titulo: "  ", tesis: "x", categoriaId: null })

    expect(resultado).toEqual({ ok: false, error: "Escribe un título y una tesis." })
  })

  it("refuses a theory that is still being written, and someone who is not a member", async () => {
    const { teoriaId } = await pedida()
    const entrada = { teoriaId, titulo: "T", tesis: "x", categoriaId: null }

    expect(await guardarTeoria(deps(coni), entrada)).toEqual({
      ok: false,
      error: "Esa teoría todavía no está lista para guardar.",
    })
    expect(await guardarTeoria(deps(otra), entrada)).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
  })

  it("says so when the theory is gone", async () => {
    const resultado = await guardarTeoria(deps(coni), {
      teoriaId: randomUUID(),
      titulo: "T",
      tesis: "x",
      categoriaId: null,
    })

    expect(resultado).toEqual({ ok: false, error: "Esa teoría ya no existe." })
  })
})

describe("lectura", () => {
  it("reads one theory with the titles of its sources, and lists them newest first", async () => {
    const { teoriaId, ids } = await conBorrador()

    const leida = await leerTeoria(coni, teoriaId)
    const lista = await listarTeorias(coni)

    expect(leida?.titulo).toBe("Título")
    expect(leida?.fuentes.map((f) => f.id).sort()).toEqual([...ids].sort())
    expect(lista.map((t) => t.id)).toContain(teoriaId)
    expect(await leerTeoria(coni, randomUUID())).toBeNull()
  })

  it("shows nothing to someone who is neither Coni nor WAV", async () => {
    const { teoriaId } = await conBorrador()

    expect(await leerTeoria(otra, teoriaId)).toBeNull()
    expect((await listarTeorias(otra)).map((t) => t.id)).not.toContain(teoriaId)
  })

  it("puts only saved theories on the graph", async () => {
    const { teoriaId, ids } = await conBorrador()
    expect((await teoriasDelGrafo(coni)).map((t) => t.id)).not.toContain(teoriaId)

    await guardarTeoria(deps(coni), { teoriaId, titulo: "Guardada", tesis: "Tesis.", categoriaId: null })

    const enElGrafo = (await teoriasDelGrafo(coni)).find((t) => t.id === teoriaId)
    expect(enElGrafo?.nombre).toBe("Guardada")
    expect(enElGrafo?.materiales.sort()).toEqual([...ids].sort())
  })
})
