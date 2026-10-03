import { describe, expect, it } from "vitest"
import {
  alternarSeleccion,
  MAXIMO_PARA_SINTETIZAR,
  MINIMO_PARA_SINTETIZAR,
  puedeSintetizar,
} from "@/lib/ingesta/seleccion"

describe("alternarSeleccion", () => {
  it("adds a material that is not selected and removes one that is", () => {
    expect(alternarSeleccion(["a"], "b")).toEqual({ seleccion: ["a", "b"], lleno: false })
    expect(alternarSeleccion(["a", "b"], "a")).toEqual({ seleccion: ["b"], lleno: false })
  })

  it("refuses a ninth material and says the selection is full", () => {
    const ocho = Array.from({ length: MAXIMO_PARA_SINTETIZAR }, (_, i) => `m${i}`)

    expect(alternarSeleccion(ocho, "otro")).toEqual({ seleccion: ocho, lleno: true })
  })

  it("lets a full selection shed one", () => {
    const ocho = Array.from({ length: MAXIMO_PARA_SINTETIZAR }, (_, i) => `m${i}`)

    expect(alternarSeleccion(ocho, "m3").seleccion).toHaveLength(MAXIMO_PARA_SINTETIZAR - 1)
  })
})

describe("puedeSintetizar", () => {
  it("is true from two to eight materials", () => {
    expect(puedeSintetizar(MINIMO_PARA_SINTETIZAR - 1)).toBe(false)
    expect(puedeSintetizar(2)).toBe(true)
    expect(puedeSintetizar(8)).toBe(true)
    expect(puedeSintetizar(9)).toBe(false)
  })
})
