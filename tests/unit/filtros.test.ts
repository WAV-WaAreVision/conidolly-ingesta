import { describe, expect, it } from "vitest"
import { hayFiltros, leerFiltros } from "@/lib/ingesta/filtros"

const CATEGORIA = "11111111-2222-4333-8444-555555555555"

describe("leerFiltros", () => {
  it("reads category, author, type and state from the search params", () => {
    expect(leerFiltros({ categoria: CATEGORIA, autor: " Esther Perel ", tipo: "audio", estado: "listo" })).toEqual({
      categoria: CATEGORIA,
      autor: "Esther Perel",
      tipo: "audio",
      estado: "listo",
    })
  })

  it("ignores what is not a valid value instead of failing", () => {
    expect(leerFiltros({ categoria: "no-es-uuid", autor: "", tipo: "zip", estado: "roto" })).toEqual({})
  })

  it("takes the first of a repeated param", () => {
    expect(leerFiltros({ tipo: ["video", "audio"] })).toEqual({ tipo: "video" })
  })

  it("says whether any filter is on", () => {
    expect(hayFiltros({})).toBe(false)
    expect(hayFiltros({ estado: "fallido" })).toBe(true)
  })
})
