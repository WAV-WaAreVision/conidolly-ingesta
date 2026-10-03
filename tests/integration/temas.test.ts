import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { almacenEnMemoria } from "@/lib/almacen/almacen"
import type { DepsSubir } from "@/lib/ingesta/subir"
import { excluirAfirmacion, leerTema, listarPilares, listarTemas } from "@/lib/ingesta/temas"
import type { Database } from "@/lib/supabase/database.types"
import { clienteDeConi, clienteDeOtraPersona, clienteDeServicio, clienteDeWav } from "./sesion"

type Db = SupabaseClient<Database>

const servicio = clienteDeServicio()
const PREFIJO = "Prueba de temas "
const SOLO_PARA_MIEMBROS = "Esta app es solo para Coni y WAV."
const VECTOR_NULO = `[${new Array(1024).fill(0).join(",")}]`
const sufijo = () => randomUUID().slice(0, 6)

const deps = (db: Db): DepsSubir => ({
  db,
  almacen: almacenEnMemoria(),
  disparar: async () => {},
  ahora: () => new Date("2026-10-03T12:00:00.000Z"),
  nuevoId: randomUUID,
})

let coni: Db
let wav: Db
let otra: Db
let idConi: string
const materiales: string[] = []

async function sembrarAutor(nombre: string, tipo = "persona"): Promise<string> {
  const { data, error } = await servicio
    .from("autores")
    .insert({ nombre: `${PREFIJO}${nombre} ${sufijo()}`, tipo })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function sembrarMaterial(autorId: string, rol = "referente"): Promise<string> {
  const id = randomUUID()
  const { error } = await servicio.from("materiales").insert({
    id,
    tipo: "documento",
    titulo: `${PREFIJO}material`,
    autor_id: autorId,
    rol,
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: idConi,
    estado: "listo",
  })
  if (error) throw new Error(error.message)
  materiales.push(id)
  return id
}

async function sembrarTema(extra: { nombre?: string; categoria_id?: string; alias?: string[] } = {}): Promise<string> {
  const { nombre, ...resto } = extra
  const { data, error } = await servicio
    .from("temas")
    .insert({ nombre: `${PREFIJO}${nombre ?? "Tema"} ${sufijo()}`, centroide: VECTOR_NULO, ...resto })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function sembrarAfirmacion(
  materialId: string,
  autorId: string,
  temaId: string | null,
  extra: Partial<Database["public"]["Tables"]["afirmaciones"]["Insert"]> = {},
): Promise<string> {
  const { data, error } = await servicio
    .from("afirmaciones")
    .insert({
      material_id: materialId,
      autor_id: autorId,
      tema_id: temaId,
      tramo: 0,
      ubicacion: { pagina: 3 },
      texto: "El deseo cambia con los años.",
      cita: "El deseo cambia con los años, dijo ella.",
      tipo: "dato",
      evidencia: "opinion",
      ...extra,
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

describe("listarTemas", () => {
  it("orders by distinct authors first, then by claims, and counts the evidence mix", async () => {
    const [a, b] = await Promise.all([sembrarAutor("A"), sembrarAutor("B")])
    const [ma, mb] = await Promise.all([sembrarMaterial(a), sembrarMaterial(b)])
    const dosAutores = await sembrarTema({ nombre: "Dos autores" })
    const unoConMuchas = await sembrarTema({ nombre: "Uno con muchas" })
    await sembrarAfirmacion(ma, a, dosAutores, { evidencia: "estudio" })
    await sembrarAfirmacion(mb, b, dosAutores, { evidencia: "clinica" })
    for (let i = 0; i < 3; i++) await sembrarAfirmacion(ma, a, unoConMuchas, { evidencia: "opinion" })

    const temas = await listarTemas(coni, {})

    const ids = temas.map((tema) => tema.id)
    expect(ids.indexOf(dosAutores)).toBeLessThan(ids.indexOf(unoConMuchas))
    const doble = temas.find((tema) => tema.id === dosAutores)
    expect(doble).toMatchObject({ afirmaciones: 2, autores: 2, cubiertoPorConi: false })
    expect(doble?.evidencia).toEqual({ estudio: 1, clinica: 1 })
    expect(temas.find((tema) => tema.id === unoConMuchas)).toMatchObject({ afirmaciones: 3, autores: 1 })
  })

  it("marks a topic Coni already covered when one of its claims comes from a voz_propia material", async () => {
    const autorConi = await sembrarAutor("Voz")
    const material = await sembrarMaterial(autorConi, "voz_propia")
    const tema = await sembrarTema({ nombre: "Cubierto" })
    await sembrarAfirmacion(material, autorConi, tema)

    const temas = await listarTemas(coni, {})

    expect(temas.find((t) => t.id === tema)?.cubiertoPorConi).toBe(true)
  })

  it("keeps only the topics of one pillar when asked, and lists the pillars", async () => {
    const pilares = await listarPilares(coni)
    const pilar = pilares[0]
    if (!pilar) throw new Error("La base local no tiene pilares sembrados.")
    const dentro = await sembrarTema({ nombre: "En el pilar", categoria_id: pilar.id })
    const fuera = await sembrarTema({ nombre: "Sin pilar" })

    const filtrados = await listarTemas(coni, { pilar: pilar.id })

    const ids = filtrados.map((tema) => tema.id)
    expect(ids).toContain(dentro)
    expect(ids).not.toContain(fuera)
    expect(pilares.map((p) => p.nombre)).toEqual(
      [...pilares.map((p) => p.nombre)].sort((x, y) => x.localeCompare(y, "es")),
    )
  })

  it("shows nothing to someone who is not a member", async () => {
    await sembrarTema()

    expect(await listarTemas(otra, {})).toEqual([])
  })
})

describe("leerTema", () => {
  it("reads the topic with its claims grouped by author and without the hidden ones", async () => {
    const [a, b] = await Promise.all([sembrarAutor("Primera"), sembrarAutor("Segunda")])
    const [ma, mb] = await Promise.all([sembrarMaterial(a), sembrarMaterial(b)])
    const tema = await sembrarTema({ nombre: "Detalle", alias: ["otro nombre"] })
    await servicio.from("temas").update({ descripcion: "De qué trata." }).eq("id", tema)
    const visible = await sembrarAfirmacion(ma, a, tema, { gancho: "Un gancho", dolor: "Un dolor" })
    await sembrarAfirmacion(mb, b, tema)
    const oculta = await sembrarAfirmacion(ma, a, tema, { excluida: true })

    const leido = await leerTema(coni, tema)

    expect(leido?.tema).toMatchObject({ id: tema, descripcion: "De qué trata.", alias: ["otro nombre"] })
    expect(leido?.autores.map((grupo) => grupo.autor.id).sort()).toEqual([a, b].sort())
    const delPrimero = leido?.autores.find((grupo) => grupo.autor.id === a)
    expect(delPrimero?.afirmaciones.map((afirmacion) => afirmacion.id)).toEqual([visible])
    expect(delPrimero?.afirmaciones[0]).toMatchObject({
      gancho: "Un gancho",
      dolor: "Un dolor",
      ubicacion: { pagina: 3 },
    })
    expect(JSON.stringify(leido)).not.toContain(oculta)
  })

  it("answers null for a topic that does not exist, is merged away, or is not visible to her", async () => {
    const fusionado = await sembrarTema({ nombre: "Fusionado" })
    const destino = await sembrarTema({ nombre: "Destino" })
    await servicio.from("temas").update({ fusionado_en: destino }).eq("id", fusionado)
    const visible = await sembrarTema({ nombre: "Visible" })

    expect(await leerTema(coni, randomUUID())).toBeNull()
    expect(await leerTema(coni, fusionado)).toBeNull()
    expect(await leerTema(otra, visible)).toBeNull()
  })
})

describe("excluirAfirmacion", () => {
  it("hides a claim and shows it again, as Coni or as WAV, and hiding detaches it from its topic", async () => {
    const autor = await sembrarAutor("Oculta")
    const material = await sembrarMaterial(autor)
    const tema = await sembrarTema()
    const id = await sembrarAfirmacion(material, autor, tema)

    expect(await excluirAfirmacion(deps(coni), { id, excluida: true })).toEqual({ ok: true })
    const oculta = await servicio.from("afirmaciones").select("excluida, tema_id").eq("id", id).single()
    expect(oculta.data).toEqual({ excluida: true, tema_id: null })

    expect(await excluirAfirmacion(deps(wav), { id, excluida: false })).toEqual({ ok: true })
    const visible = await servicio.from("afirmaciones").select("excluida").eq("id", id).single()
    expect(visible.data).toEqual({ excluida: false })
  })

  it("says the claim is gone when it does not exist", async () => {
    expect(await excluirAfirmacion(deps(coni), { id: randomUUID(), excluida: true })).toEqual({
      ok: false,
      error: "Esa afirmación ya no existe.",
    })
  })

  it("refuses a malformed request and anyone who is not a member, and changes nothing", async () => {
    const autor = await sembrarAutor("Ajena")
    const material = await sembrarMaterial(autor)
    const id = await sembrarAfirmacion(material, autor, null)

    expect((await excluirAfirmacion(deps(coni), { id: "no-es-un-id", excluida: true })).ok).toBe(false)
    expect(await excluirAfirmacion(deps(otra), { id, excluida: true })).toEqual({
      ok: false,
      error: SOLO_PARA_MIEMBROS,
    })
    const fila = await servicio.from("afirmaciones").select("excluida").eq("id", id).single()
    expect(fila.data).toEqual({ excluida: false })
  })
})
