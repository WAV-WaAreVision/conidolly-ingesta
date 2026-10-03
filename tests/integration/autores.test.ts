import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import {
  borrarAutor,
  crearAutor,
  fusionarAutores,
  leerAutor,
  listarAutores,
  resumirAutores,
} from "@/lib/ingesta/autores"
import type { DepsSubir } from "@/lib/ingesta/subir"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeOtraPersona, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."
const PREFIJO = "Prueba de autores "
const nombre = () => `${PREFIJO}${randomUUID().slice(0, 8)}`

let coni: Db
let wav: Db
let otra: Db
let idConi: string
const materiales: string[] = []
const VECTOR_NULO = `[${new Array(1024).fill(0).join(",")}]`

const deps = (db: Db): DepsSubir => ({
  db,
  almacen: almacenEnMemoria(),
  disparar: async () => {},
  ahora: () => new Date("2026-10-03T12:00:00.000Z"),
  nuevoId: randomUUID,
})

async function autorNuevo(nombreBase = "Autor"): Promise<string> {
  const creada = await crearAutor({ db: coni }, { nombre: nombre(), credencial: nombreBase, tipo: "persona" })
  if (!creada.ok) throw new Error(creada.error)
  return creada.autor.id
}

async function sembrarMaterial(autorId: string): Promise<string> {
  const id = randomUUID()
  const { error } = await servicio.from("materiales").insert({
    id,
    tipo: "documento",
    titulo: `${PREFIJO}material`,
    autor_id: autorId,
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: idConi,
    estado: "listo",
  })
  if (error) throw new Error(error.message)
  materiales.push(id)
  return id
}

async function sembrarTema(titulo: string): Promise<string> {
  const { data, error } = await servicio
    .from("temas")
    .insert({ nombre: `${PREFIJO}${titulo} ${randomUUID().slice(0, 6)}`, centroide: VECTOR_NULO })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function sembrarAfirmacion(
  materialId: string,
  autorId: string,
  temaId: string | null,
  extra: { excluida?: boolean; texto?: string } = {},
): Promise<string> {
  const { data, error } = await servicio
    .from("afirmaciones")
    .insert({
      material_id: materialId,
      autor_id: autorId,
      tema_id: temaId,
      tramo: 0,
      ubicacion: { pagina: 7 },
      texto: extra.texto ?? "El deseo cambia con los años.",
      cita: "El deseo cambia con los años, dijo ella.",
      tipo: "dato",
      evidencia: "opinion",
      excluida: extra.excluida ?? false,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

beforeAll(async () => {
  ;[coni, wav, otra] = await Promise.all([clienteDeConi(), clienteDeWav(), clienteDeOtraPersona()])
  idConi = (await coni.auth.getUser()).data.user?.id ?? ""
})

afterEach(async () => {
  if (materiales.length > 0) await servicio.from("materiales").delete().in("id", materiales.splice(0))
})

afterAll(async () => {
  await servicio.from("temas").delete().like("nombre", `${PREFIJO}%`)
  await servicio.from("autores").delete().like("nombre", `${PREFIJO}%`)
})

describe("crearAutor", () => {
  it("creates an author through crear_autor with its credential and type, as Coni or as WAV", async () => {
    const delaConi = await crearAutor(
      { db: coni },
      { nombre: nombre(), credencial: " Psicóloga clínica ", tipo: "persona" },
    )
    const deWav = await crearAutor({ db: wav }, { nombre: nombre(), credencial: "", tipo: "cuenta" })

    expect(delaConi.ok && delaConi.autor).toMatchObject({ credencial: "Psicóloga clínica", tipo: "persona", alias: [] })
    expect(deWav.ok && deWav.autor).toMatchObject({ credencial: null, tipo: "cuenta" })
  })

  it("answers the existing author when the name was already taken, whatever the accents and case", async () => {
    const base = `${PREFIJO}Brené ${randomUUID().slice(0, 6)}`
    const primera = await crearAutor({ db: coni }, { nombre: base, credencial: "", tipo: "persona" })
    const repetida = await crearAutor(
      { db: coni },
      { nombre: `  ${base.toUpperCase().replace("É", "E")} `, credencial: "", tipo: "persona" },
    )

    expect(primera.ok && repetida.ok && repetida.autor.id === primera.autor.id).toBe(true)
  })

  it("answers the author whose alias is the typed name", async () => {
    const creada = await crearAutor({ db: coni }, { nombre: nombre(), credencial: "", tipo: "persona" })
    if (!creada.ok) throw new Error(creada.error)
    const alias = `${PREFIJO}Apodo ${randomUUID().slice(0, 6)}`
    const { error } = await servicio
      .from("autores")
      .update({ alias: [alias] })
      .eq("id", creada.autor.id)
    if (error) throw new Error(error.message)

    const buscada = await crearAutor({ db: wav }, { nombre: alias, credencial: "", tipo: "persona" })

    expect(buscada.ok && buscada.autor.id).toBe(creada.autor.id)
  })

  it("asks for a name", async () => {
    expect(await crearAutor({ db: coni }, { nombre: "   ", credencial: "", tipo: "persona" })).toEqual({
      ok: false,
      error: "Escribe el nombre del autor.",
    })
  })

  it.each(["coni", "robot", ""])("refuses the type %j: Coni herself is only created by the seed", async (tipo) => {
    const resultado = await crearAutor({ db: coni }, { nombre: nombre(), credencial: "", tipo })

    expect(resultado).toEqual({ ok: false, error: "Elige si es una persona, una cuenta o una institución." })
  })

  it("says in plain Spanish that Coni cannot be created if the database ever refuses the type", async () => {
    const rechazaTipoConi = new Proxy(coni, {
      get: (objetivo, propiedad) =>
        propiedad === "rpc"
          ? (nombreRpc: never, argumentos: never) =>
              nombreRpc === "crear_autor"
                ? Promise.resolve({ data: null, error: { code: "22023", message: "tipo_coni_reservado" } })
                : objetivo.rpc(nombreRpc, argumentos)
          : Reflect.get(objetivo, propiedad),
    })

    expect(await crearAutor({ db: rechazaTipoConi }, { nombre: nombre(), credencial: "", tipo: "persona" })).toEqual({
      ok: false,
      error: "La autora Coni ya existe y no se puede crear otra.",
    })
  })

  it("refuses anyone who is neither Coni nor WAV and creates nothing", async () => {
    const nuevo = nombre()

    expect(await crearAutor({ db: otra }, { nombre: nuevo, credencial: "", tipo: "persona" })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    const { count } = await servicio.from("autores").select("id", { count: "exact", head: true }).eq("nombre", nuevo)
    expect(count).toBe(0)
  })
})

describe("listarAutores", () => {
  it("lists the authors in alphabetical order with their name, credential, type and aliases", async () => {
    const creada = await crearAutor({ db: coni }, { nombre: nombre(), credencial: "Terapeuta", tipo: "institucion" })
    if (!creada.ok) throw new Error(creada.error)

    const autores = await listarAutores(coni)

    expect(autores.find((autor) => autor.id === creada.autor.id)).toEqual(creada.autor)
    expect(autores.some((autor) => autor.tipo === "coni")).toBe(true)
    const nombres = autores.map((autor) => autor.nombre)
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, "es")))
  })

  it("shows nothing to someone who is not a member", async () => {
    expect(await listarAutores(otra)).toEqual([])
  })
})

describe("resumirAutores", () => {
  it("counts each author's materials and visible claims and lists the three topics with most claims", async () => {
    const autor = await autorNuevo()
    const material = await sembrarMaterial(autor)
    await sembrarMaterial(autor)
    const [grande, mediano, chico, cuarto] = await Promise.all(
      ["Grande", "Mediano", "Chico", "Cuarto"].map((titulo) => sembrarTema(titulo)),
    )
    const reparto: [string | undefined, number][] = [
      [grande, 4],
      [mediano, 3],
      [chico, 2],
      [cuarto, 1],
    ]
    for (const [tema, cuantas] of reparto) {
      for (let i = 0; i < cuantas; i++) await sembrarAfirmacion(material, autor, tema ?? null)
    }
    await sembrarAfirmacion(material, autor, grande ?? null, { excluida: true })

    const resumen = (await resumirAutores(coni)).find((fila) => fila.id === autor)

    expect(resumen).toMatchObject({ materiales: 2, afirmaciones: 10 })
    expect(resumen?.temas.map((tema) => [tema.id, tema.afirmaciones])).toEqual([
      [grande, 4],
      [mediano, 3],
      [chico, 2],
    ])
  })

  it("lists an author with no material at zero, and keeps the alphabetical order", async () => {
    const autor = await autorNuevo()

    const resumenes = await resumirAutores(wav)

    expect(resumenes.find((fila) => fila.id === autor)).toMatchObject({ materiales: 0, afirmaciones: 0, temas: [] })
    const nombres = resumenes.map((fila) => fila.nombre)
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, "es")))
  })

  it("shows nothing to someone who is not a member", async () => {
    expect(await resumirAutores(otra)).toEqual([])
  })
})

describe("leerAutor", () => {
  it("groups the author's visible claims by topic with quote and location, and the hidden ones apart", async () => {
    const autor = await autorNuevo()
    const material = await sembrarMaterial(autor)
    const [apego, deseo] = await Promise.all([sembrarTema("Apego"), sembrarTema("Deseo")])
    const a1 = await sembrarAfirmacion(material, autor, apego)
    await sembrarAfirmacion(material, autor, apego)
    const d1 = await sembrarAfirmacion(material, autor, deseo)
    const suelta = await sembrarAfirmacion(material, autor, null)
    const oculta = await sembrarAfirmacion(material, autor, null, { excluida: true })

    const leido = await leerAutor(coni, autor)

    expect(leido?.autor.id).toBe(autor)
    expect(leido?.grupos.map((grupo) => [grupo.tema?.id ?? null, grupo.afirmaciones.length])).toEqual([
      [apego, 2],
      [deseo, 1],
      [null, 1],
    ])
    expect(leido?.grupos[0]?.afirmaciones.map((f) => f.id)).toContain(a1)
    expect(leido?.grupos[1]?.afirmaciones[0]).toMatchObject({
      id: d1,
      cita: "El deseo cambia con los años, dijo ella.",
      ubicacion: { pagina: 7 },
    })
    expect(leido?.grupos[2]?.afirmaciones.map((f) => f.id)).toEqual([suelta])
    expect(leido?.ocultas.map((f) => f.id)).toEqual([oculta])
  })

  it("counts the author's materials, so the page knows whether it can be deleted", async () => {
    const sinMateriales = await autorNuevo()
    const conMateriales = await autorNuevo()
    await sembrarMaterial(conMateriales)
    await sembrarMaterial(conMateriales)

    expect((await leerAutor(coni, sinMateriales))?.materiales).toBe(0)
    expect((await leerAutor(coni, conMateriales))?.materiales).toBe(2)
  })

  it("answers null for an author that does not exist or that she cannot see", async () => {
    const autor = await autorNuevo()

    expect(await leerAutor(coni, randomUUID())).toBeNull()
    expect(await leerAutor(otra, autor)).toBeNull()
  })
})

describe("fusionarAutores", () => {
  it("moves materials and claims to the destination and removes the origin, as Coni or as WAV", async () => {
    const origen = await autorNuevo()
    const destino = await autorNuevo()
    const material = await sembrarMaterial(origen)
    const afirmacion = await sembrarAfirmacion(material, origen, null)

    expect(await fusionarAutores(deps(wav), { origen, destino })).toEqual({ ok: true })

    const propiedades = await servicio.from("materiales").select("autor_id").eq("id", material).single()
    const claim = await servicio.from("afirmaciones").select("autor_id").eq("id", afirmacion).single()
    const borrado = await servicio.from("autores").select("id").eq("id", origen)
    expect(propiedades.data?.autor_id).toBe(destino)
    expect(claim.data?.autor_id).toBe(destino)
    expect(borrado.data).toEqual([])
  })

  it("refuses to merge an author into itself, and never lets Coni herself be the one that disappears", async () => {
    const autor = await autorNuevo()
    const { data } = await servicio.from("autores").select("id").eq("tipo", "coni").single()
    const coniId = data?.id ?? ""

    expect(await fusionarAutores(deps(coni), { origen: autor, destino: autor })).toEqual({
      ok: false,
      error: "Elige otro autor para unirlos.",
    })
    expect(await fusionarAutores(deps(coni), { origen: coniId, destino: autor })).toEqual({
      ok: false,
      error: "Coni no se puede unir a otro autor.",
    })
    const sigue = await servicio.from("autores").select("id").eq("id", coniId)
    expect(sigue.data).toHaveLength(1)
  })

  it("says the author is gone when either does not exist", async () => {
    const autor = await autorNuevo()

    expect(await fusionarAutores(deps(coni), { origen: randomUUID(), destino: autor })).toEqual({
      ok: false,
      error: "Ese autor ya no existe.",
    })
    expect(await fusionarAutores(deps(coni), { origen: autor, destino: randomUUID() })).toEqual({
      ok: false,
      error: "Ese autor ya no existe.",
    })
  })

  it("refuses anyone who is not a member and merges nothing", async () => {
    const origen = await autorNuevo()
    const destino = await autorNuevo()

    expect(await fusionarAutores(deps(otra), { origen, destino })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    const sigue = await servicio.from("autores").select("id").eq("id", origen)
    expect(sigue.data).toHaveLength(1)
  })
})

describe("borrarAutor", () => {
  it("deletes an author without materials, as Coni or as WAV", async () => {
    const deConi = await autorNuevo()
    const deWav = await autorNuevo()

    expect(await borrarAutor(deps(coni), { id: deConi })).toEqual({ ok: true })
    expect(await borrarAutor(deps(wav), { id: deWav })).toEqual({ ok: true })

    const quedan = await servicio.from("autores").select("id").in("id", [deConi, deWav])
    expect(quedan.data).toEqual([])
  })

  it("refuses an author that has materials and keeps it", async () => {
    const autor = await autorNuevo()
    await sembrarMaterial(autor)

    expect(await borrarAutor(deps(coni), { id: autor })).toEqual({
      ok: false,
      error: "No se puede borrar: este autor tiene materiales.",
    })
    const sigue = await servicio.from("autores").select("id").eq("id", autor)
    expect(sigue.data).toHaveLength(1)
  })

  it("never deletes Coni herself", async () => {
    const { data } = await servicio.from("autores").select("id").eq("tipo", "coni").single()
    const coniId = data?.id ?? ""

    expect(await borrarAutor(deps(coni), { id: coniId })).toEqual({
      ok: false,
      error: "La autora Coni no se puede borrar.",
    })
    const sigue = await servicio.from("autores").select("id").eq("id", coniId)
    expect(sigue.data).toHaveLength(1)
  })

  it("says the author is gone when it does not exist, and rejects a malformed id", async () => {
    expect(await borrarAutor(deps(coni), { id: randomUUID() })).toEqual({ ok: false, error: "Ese autor ya no existe." })
    expect((await borrarAutor(deps(coni), { id: "no-es-uuid" })).ok).toBe(false)
  })

  it("refuses anyone who is not a member and deletes nothing", async () => {
    const autor = await autorNuevo()

    expect(await borrarAutor(deps(otra), { id: autor })).toEqual({ ok: false, error: SOLO_PARA_MIEMBROS })
    const sigue = await servicio.from("autores").select("id").eq("id", autor)
    expect(sigue.data).toHaveLength(1)
  })
})
