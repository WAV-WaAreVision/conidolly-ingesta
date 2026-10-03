import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crearAutor, listarAutores } from "@/lib/ingesta/autores"
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

beforeAll(async () => {
  ;[coni, wav, otra] = await Promise.all([clienteDeConi(), clienteDeWav(), clienteDeOtraPersona()])
})

afterAll(async () => {
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
    await coni.rpc("editar_autor", {
      p_id: creada.autor.id,
      p_nombre: creada.autor.nombre,
      p_credencial: "",
      p_alias: [alias],
    })

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
