import { describe, expect, it } from "vitest"
import { adaptacionDe, leerEdicion, leerFicha, textoDeUbicacion } from "@/lib/ingesta/ficha"

const MATERIAL = "11111111-2222-4333-8444-555555555555"
const IDEAS = ["uno", "dos", "tres", "cuatro", "cinco"]
const edicion = (extra: Record<string, unknown> = {}) => ({
  materialId: MATERIAL,
  resumen: "Un resumen.",
  ideasClave: IDEAS,
  citas: [],
  fuente: { autor: "Esther Perel", anio: 2017, enlace: "https://example.com/nota" },
  ...extra,
})

describe("textoDeUbicacion", () => {
  it.each([
    [{ pagina: 12 }, "página 12"],
    [{ pagina: null }, null],
    [{ segundo: 75, pista: "voz" }, "1:15"],
    [{ segundo: 9.8, pista: "pantalla" }, "0:09"],
    [{ segundo: 3725, pista: "voz" }, "62:05"],
    [{ imagen: 3 }, "imagen 3"],
  ] as const)("writes %j as %j", (ubicacion, esperado) => {
    expect(textoDeUbicacion(ubicacion)).toBe(esperado)
  })
})

describe("adaptacionDe", () => {
  it("says it was only adapted when the original is Spanish", () => {
    expect(adaptacionDe("es")).toBe("Adaptado a la voz de Coni")
  })

  it.each([
    ["en", "Traducido del inglés y adaptado a la voz de Coni"],
    ["pt", "Traducido del portugués y adaptado a la voz de Coni"],
    ["fr", "Traducido del francés y adaptado a la voz de Coni"],
    ["de", "Traducido del alemán y adaptado a la voz de Coni"],
    ["it", "Traducido del italiano y adaptado a la voz de Coni"],
  ])("names the language of %s", (codigo, esperado) => {
    expect(adaptacionDe(codigo)).toBe(esperado)
  })

  it("falls back to another language for a code it does not know", () => {
    expect(adaptacionDe("xx")).toBe("Traducido de otro idioma y adaptado a la voz de Coni")
  })

  it("reads an unknown original (null) as Spanish: nothing was translated", () => {
    expect(adaptacionDe(null)).toBe("Adaptado a la voz de Coni")
  })
})

describe("leerFicha", () => {
  it("reads the json columns of a card", () => {
    const ficha = leerFicha({
      resumen: "r",
      ideas_clave: ["a", "b"],
      citas: [{ texto: "t", ubicacion: { pagina: 2 } }],
      fuente: { autor: null, anio: 2020, enlace: null },
    })
    expect(ficha).toEqual({
      resumen: "r",
      ideasClave: ["a", "b"],
      citas: [{ texto: "t", ubicacion: { pagina: 2 } }],
      fuente: { autor: null, anio: 2020, enlace: null },
    })
  })

  it("is null when a column does not have the shape the task writes", () => {
    expect(leerFicha({ resumen: "r", ideas_clave: "no", citas: [], fuente: {} })).toBeNull()
  })
})

describe("leerEdicion", () => {
  it("accepts a complete edit and trims the text", () => {
    const leida = leerEdicion(
      edicion({
        resumen: "  Un resumen.  ",
        ideasClave: ["  uno ", "dos", "tres", "cuatro", "cinco"],
        citas: [{ texto: " Una cita ", ubicacion: { segundo: 5, pista: "voz" } }],
      }),
    )
    expect(leida).toEqual({
      ok: true,
      datos: expect.objectContaining({
        resumen: "Un resumen.",
        ideasClave: ["uno", "dos", "tres", "cuatro", "cinco"],
        citas: [{ texto: "Una cita", ubicacion: { segundo: 5, pista: "voz" } }],
      }),
    })
  })

  it("drops blank ideas and quotes before counting", () => {
    const leida = leerEdicion(
      edicion({ ideasClave: [...IDEAS, "  ", ""], citas: [{ texto: "   ", ubicacion: { pagina: 1 } }] }),
    )
    expect(leida).toMatchObject({ ok: true, datos: { ideasClave: IDEAS, citas: [] } })
  })

  it.each([
    ["four ideas", { ideasClave: IDEAS.slice(0, 4) }],
    ["eleven ideas", { ideasClave: [...IDEAS, "6", "7", "8", "9", "10", "11"] }],
  ])("asks for 5 to 10 key ideas with %s", (_n, extra) => {
    expect(leerEdicion(edicion(extra))).toEqual({ ok: false, error: "Deja entre 5 y 10 ideas clave." })
  })

  it("refuses an empty summary", () => {
    expect(leerEdicion(edicion({ resumen: "   " }))).toEqual({ ok: false, error: "El resumen no puede quedar vacío." })
  })

  it("turns a blank source field into null and refuses a link that is not http(s)", () => {
    expect(leerEdicion(edicion({ fuente: { autor: " ", anio: null, enlace: "" } }))).toMatchObject({
      ok: true,
      datos: { fuente: { autor: null, anio: null, enlace: null } },
    })
    expect(leerEdicion(edicion({ fuente: { autor: null, anio: null, enlace: "javascript:alert(1)" } }))).toEqual({
      ok: false,
      error: "El enlace de la fuente no es válido.",
    })
  })

  it("refuses a request that is not shaped like the form", () => {
    expect(leerEdicion({ materialId: "no", resumen: 3 })).toEqual({
      ok: false,
      error: "No entendí esa solicitud. Vuelve a abrir la pantalla.",
    })
  })
})
