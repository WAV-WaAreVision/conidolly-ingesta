import { describe, expect, it } from "vitest"
import {
  aTeoriaDelGrafo,
  aTeoriaLeida,
  estaSintetizando,
  etiquetaDeEstadoDeTeoria,
  puedeReintentarse,
} from "@/lib/ingesta/modelo-de-teoria"

const A = "11111111-2222-4333-8444-555555555551"
const B = "11111111-2222-4333-8444-555555555552"

const fila = (extra: Record<string, unknown> = {}) => ({
  id: "t1",
  titulo: "El deseo se conversa",
  tesis: "Hablarlo cuida.",
  argumentos: [
    { materialId: A, aporte: "Dice que el deseo cambia.", cita: "El deseo no es lineal.", ubicacion: "idea 2" },
  ],
  contradicciones: [{ materialIds: [A, B], descripcion: "Chocan en el ritmo." }],
  categoria_id: null,
  estado: "borrador",
  motivo_fallo: null,
  motivo_codigo: null,
  creada_en: "2026-10-03T12:00:00Z",
  teoria_fuentes: [
    { material_id: A, materiales: { titulo: "Libro del deseo" } },
    { material_id: B, materiales: null },
  ],
  ...extra,
})

describe("aTeoriaLeida", () => {
  it("reads the synthesis with the title of each source, 'Sin título' when it has none", () => {
    expect(aTeoriaLeida(fila())).toEqual({
      id: "t1",
      titulo: "El deseo se conversa",
      tesis: "Hablarlo cuida.",
      argumentos: [
        { materialId: A, aporte: "Dice que el deseo cambia.", cita: "El deseo no es lineal.", ubicacion: "idea 2" },
      ],
      contradicciones: [{ materialIds: [A, B], descripcion: "Chocan en el ritmo." }],
      categoriaId: null,
      estado: "borrador",
      motivoFallo: null,
      motivoCodigo: null,
      fuentes: [
        { id: A, titulo: "Libro del deseo" },
        { id: B, titulo: "Sin título" },
      ],
    })
  })

  it("reads a theory that is still being written, with nothing in its fields", () => {
    const leida = aTeoriaLeida(
      fila({ titulo: null, tesis: null, argumentos: null, contradicciones: null, estado: "sintetizando" }),
    )

    expect(leida).toMatchObject({
      titulo: null,
      tesis: null,
      argumentos: [],
      contradicciones: [],
      estado: "sintetizando",
    })
  })

  it("answers null when the synthesis does not have the shape the task writes", () => {
    expect(aTeoriaLeida(fila({ argumentos: [{ materialId: 3 }] }))).toBeNull()
  })
})

describe("estado de una teoría", () => {
  it("says it in words for Coni and knows when to keep polling", () => {
    expect(etiquetaDeEstadoDeTeoria("sintetizando")).toBe("Armándose")
    expect(etiquetaDeEstadoDeTeoria("borrador")).toBe("Borrador")
    expect(etiquetaDeEstadoDeTeoria("guardada")).toBe("Guardada")
    expect(etiquetaDeEstadoDeTeoria("fallida")).toBe("No salió")
    expect(estaSintetizando({ estado: "sintetizando" })).toBe(true)
    expect(estaSintetizando({ estado: "borrador" })).toBe(false)
  })
})

describe("aTeoriaDelGrafo", () => {
  it("draws a saved theory under its title, tied to its sources, and leaves out the ones that are not saved", () => {
    const guardada = { id: "t1", titulo: "Mi teoría", estado: "guardada", fuentes: [A, B] }

    expect(aTeoriaDelGrafo(guardada)).toEqual({ id: "t1", nombre: "Mi teoría", materiales: [A, B] })
    expect(aTeoriaDelGrafo({ ...guardada, estado: "borrador" })).toBeNull()
    expect(aTeoriaDelGrafo({ ...guardada, titulo: null })).toBeNull()
  })
})

describe("puedeReintentarse", () => {
  const leida = (extra: Record<string, unknown>) => {
    const teoria = aTeoriaLeida(fila(extra))
    if (!teoria) throw new Error("no se pudo leer")
    return teoria
  }

  it.each([
    ["error", true],
    ["tope", true],
    [null, true],
    ["sin_sustento", false],
  ])("says whether a theory that failed with code %s can be retried: %s", (motivo_codigo, esperado) => {
    expect(puedeReintentarse(leida({ estado: "fallida", motivo_fallo: "No salió", motivo_codigo }))).toBe(esperado)
  })

  it("never offers a retry for a theory that did not fail", () => {
    expect(puedeReintentarse(leida({ estado: "borrador" }))).toBe(false)
  })
})
