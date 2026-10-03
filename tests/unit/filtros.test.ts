import { describe, expect, it } from "vitest"
import { hayFiltros, leerFiltros } from "@/lib/ingesta/filtros"

const AUTOR = "11111111-2222-4333-8444-555555555555"

describe("leerFiltros", () => {
  it("reads author, role, type and state from the search params", () => {
    expect(leerFiltros({ autor: AUTOR, rol: "evidencia", tipo: "audio", estado: "listo" })).toEqual({
      autor: AUTOR,
      rol: "evidencia",
      tipo: "audio",
      estado: "listo",
    })
  })

  it("ignores what is not a valid value instead of failing", () => {
    expect(leerFiltros({ autor: "Esther Perel", rol: "jefa", tipo: "zip", estado: "roto" })).toEqual({})
  })

  it("no longer reads a category", () => {
    expect(leerFiltros({ categoria: AUTOR })).toEqual({})
  })

  it("takes the first of a repeated param", () => {
    expect(leerFiltros({ tipo: ["video", "audio"] })).toEqual({ tipo: "video" })
  })

  it("says whether any filter is on", () => {
    expect(hayFiltros({})).toBe(false)
    expect(hayFiltros({ estado: "fallido" })).toBe(true)
  })
})
