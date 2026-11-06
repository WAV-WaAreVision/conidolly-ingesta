import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import { crearAutor, leerAutor, listarAutores, resumirAutores } from "@/lib/ingesta/autores"
import { editarMaterial, leerMapaDelMaterial, leerMaterialConFicha, listarMateriales } from "@/lib/ingesta/materiales"
import { confirmarMaterial, type DepsSubir } from "@/lib/ingesta/subir"
import { leerTema, listarTemas } from "@/lib/ingesta/temas"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeServicio } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const PREFIJO = "Prueba de borrado diferido "
const VECTOR_NULO = `[${new Array(1024).fill(0).join(",")}]`
const sufijo = () => randomUUID().slice(0, 6)

let coni: Db
let idConi = ""
let autora = ""
let marcada = ""
let vivo = ""
let marcado = ""
let tema = ""

async function falla<T>(
  promesa: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<NonNullable<T>> {
  const { data, error } = await promesa
  if (error || data === null || data === undefined) throw new Error(error?.message ?? "La base no devolvió nada")
  return data
}

const marcar = (tabla: "materiales" | "autores", id: string, cuando: string | null) =>
  tabla === "materiales"
    ? falla(servicio.from("materiales").update({ borrar_desde: cuando }).eq("id", id).select("id"))
    : falla(servicio.from("autores").update({ borrar_desde: cuando }).eq("id", id).select("id"))

async function sembrarAutor(nombre: string): Promise<string> {
  const { data, error } = await servicio
    .from("autores")
    .insert({ nombre: `${PREFIJO}${nombre} ${sufijo()}`, tipo: "persona" })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function sembrarMaterial(autorId: string): Promise<string> {
  const id = randomUUID()
  await falla(
    servicio
      .from("materiales")
      .insert({
        id,
        tipo: "documento",
        titulo: `${PREFIJO}material`,
        autor_id: autorId,
        rol: "referente",
        texto_pegado: "x",
        declaracion_sin_pacientes_en: new Date().toISOString(),
        subido_por: idConi,
        estado: "listo",
      })
      .select("id"),
  )
  return id
}

async function sembrarIdea(materialId: string, autorId: string, temaId: string): Promise<void> {
  await falla(
    servicio
      .from("afirmaciones")
      .insert({
        material_id: materialId,
        autor_id: autorId,
        tema_id: temaId,
        tramo: 0,
        ubicacion: { pagina: 1 },
        texto: "Una idea",
        cita: "Una cita",
        tipo: "dato",
        evidencia: "opinion",
      })
      .select("id"),
  )
}

beforeAll(async () => {
  coni = await clienteDeConi()
  idConi = (await coni.auth.getUser()).data.user?.id ?? ""
  autora = await sembrarAutor("Autora")
  marcada = await sembrarAutor("Marcada")
  const { data: filaDeTema, error } = await servicio
    .from("temas")
    .insert({ nombre: `${PREFIJO}Tema ${sufijo()}`, centroide: VECTOR_NULO })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  tema = filaDeTema.id
  vivo = await sembrarMaterial(autora)
  marcado = await sembrarMaterial(autora)
  await sembrarIdea(vivo, autora, tema)
  await sembrarIdea(marcado, autora, tema)
  await sembrarIdea(marcado, autora, tema)
  await marcar("materiales", marcado, new Date().toISOString())
  await marcar("autores", marcada, new Date().toISOString())
})

afterAll(async () => {
  await servicio.from("materiales").delete().in("id", [vivo, marcado])
  await servicio.from("temas").delete().like("nombre", `${PREFIJO}%`)
  await servicio.from("autores").delete().like("nombre", `${PREFIJO}%`)
})

describe("Ingesta hides what Conidolly marked for deletion", () => {
  it("in the materials list, the detail and the map", async () => {
    const ids = (await listarMateriales(coni, {})).map((material) => material.id)
    expect(ids).toContain(vivo)
    expect(ids).not.toContain(marcado)
    expect(await leerMaterialConFicha(coni, marcado)).toBeNull()
    expect((await leerMapaDelMaterial(coni, marcado)).total).toBe(0)
  })

  it("in the authors, their counts and their pages", async () => {
    expect((await listarAutores(coni)).map((autor) => autor.id)).not.toContain(marcada)
    const resumen = (await resumirAutores(coni)).find((autor) => autor.id === autora)
    expect(resumen).toMatchObject({ materiales: 1, afirmaciones: 1 })
    expect(await leerAutor(coni, marcada)).toBeNull()
    const leido = await leerAutor(coni, autora)
    expect(leido?.materiales).toBe(1)
    expect(leido?.grupos.flatMap((grupo) => grupo.afirmaciones)).toHaveLength(1)
  })

  it("in the topics and a topic's page", async () => {
    expect((await listarTemas(coni, {})).find((t) => t.id === tema)).toMatchObject({ afirmaciones: 1, autores: 1 })
    const leido = await leerTema(coni, tema)
    expect(leido?.autores.flatMap((grupo) => grupo.afirmaciones)).toHaveLength(1)
  })
})

const deps = (db: Db): DepsSubir => ({
  db,
  almacen: almacenEnMemoria(),
  disparar: async () => {},
  ahora: () => new Date("2026-11-06T12:00:00.000Z"),
  nuevoId: randomUUID,
})

describe("Ingesta's actions on a marked row", () => {
  it("editarMaterial and confirmarMaterial answer not found", async () => {
    expect(await editarMaterial(deps(coni), { materialId: marcado, autorId: autora, rol: "evidencia" })).toEqual({
      ok: false,
      error: "No encontré ese material.",
    })
    expect(await confirmarMaterial(deps(coni), { materialId: marcado })).toEqual({
      ok: false,
      error: "No encontré ese material.",
    })
  })

  it("crearAutor with a marked author's name brings it back", async () => {
    const { nombre } = (await falla(servicio.from("autores").select("nombre").eq("id", marcada)))[0] ?? { nombre: "" }
    const resultado = await crearAutor(deps(coni), { nombre, tipo: "persona" })
    expect(resultado).toMatchObject({ ok: true, autor: { id: marcada } })
    const [fila] = await falla(servicio.from("autores").select("borrar_desde").eq("id", marcada))
    expect(fila?.borrar_desde).toBeNull()
    await marcar("autores", marcada, new Date().toISOString())
  })
})
