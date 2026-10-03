import { describe, expect, it } from "vitest"
import { type AutorDeLista, autoresParecidos, buscarAutores } from "@/lib/ingesta/buscar-autor"

const autor = (id: string, nombre: string, extra: Partial<AutorDeLista> = {}): AutorDeLista => ({
  id,
  nombre,
  credencial: null,
  tipo: "persona",
  alias: [],
  ...extra,
})

const AUTORES = [
  autor("1", "Esther Perel", { credencial: "Psicoterapeuta de parejas", alias: ["E. Perel"] }),
  autor("2", "Constanza del Rosario", { tipo: "coni" }),
  autor("3", "Instituto Gottman", { tipo: "institucion", alias: ["Gottman Institute"] }),
  autor("4", "@sexologa_en_casa", { tipo: "cuenta" }),
]

describe("buscarAutores", () => {
  it("finds an author by part of the name, ignoring case and accents", () => {
    expect(buscarAutores(AUTORES, "ESTHER").map((a) => a.id)).toEqual(["1"])
    expect(buscarAutores(AUTORES, "constánza").map((a) => a.id)).toEqual(["2"])
  })

  it("finds an author by an alias", () => {
    expect(buscarAutores(AUTORES, "gottman institute").map((a) => a.id)).toEqual(["3"])
  })

  it("lists everyone, in order, when nothing is typed", () => {
    expect(buscarAutores(AUTORES, "  ").map((a) => a.id)).toEqual(["1", "2", "3", "4"])
  })

  it("finds nobody for a name that matches nothing", () => {
    expect(buscarAutores(AUTORES, "Brené")).toEqual([])
  })
})

describe("autoresParecidos", () => {
  it("suggests the author whose name is the typed one, ignoring case, accents and spaces", () => {
    expect(autoresParecidos(AUTORES, "  esther  PEREL ").map((a) => a.id)).toEqual(["1"])
  })

  it("suggests the author whose alias is the typed name", () => {
    expect(autoresParecidos(AUTORES, "e. perel").map((a) => a.id)).toEqual(["1"])
  })

  it("suggests the author when the typed name is part of the name or the name is part of what was typed", () => {
    expect(autoresParecidos(AUTORES, "Esther").map((a) => a.id)).toEqual(["1"])
    expect(autoresParecidos(AUTORES, "Dra. Esther Perel").map((a) => a.id)).toEqual(["1"])
  })

  it("does not suggest anyone for very short text or for a name with nothing in common", () => {
    expect(autoresParecidos(AUTORES, "es")).toEqual([])
    expect(autoresParecidos(AUTORES, "Brené Brown")).toEqual([])
  })
})
