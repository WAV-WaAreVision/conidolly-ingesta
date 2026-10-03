import { describe, expect, it } from "vitest"
import {
  aElementosDelGrafo,
  type MaterialDelGrafo,
  TOKENS_DE_CATEGORIA,
  tokenDeCategoria,
  type VinculoDelGrafo,
} from "@/lib/ingesta/grafo"

const material = (id: string, extra: Partial<MaterialDelGrafo> = {}): MaterialDelGrafo => ({
  id,
  titulo: `Material ${id}`,
  autor: "Autora Uno",
  categoria: "Apego",
  ...extra,
})
const vinculo = (a: string, b: string, extra: Partial<VinculoDelGrafo> = {}): VinculoDelGrafo => ({
  material_a: a,
  material_b: b,
  tipo: "complementa",
  relevancia: 3,
  estado: "aceptado",
  razon: null,
  cita_a: null,
  cita_b: null,
  ...extra,
})

const nodos = (elementos: ReturnType<typeof aElementosDelGrafo>) => elementos.filter((e) => e.group === "nodes")
const aristas = (elementos: ReturnType<typeof aElementosDelGrafo>) => elementos.filter((e) => e.group === "edges")
const nodo = (elementos: ReturnType<typeof aElementosDelGrafo>, id: string) =>
  nodos(elementos).find((e) => e.data.id === id)

describe("aElementosDelGrafo", () => {
  const materiales = [
    material("a"),
    material("b", { categoria: "Deseo", autor: "Autora Dos" }),
    material("c", { categoria: "Deseo", autor: "Autora Uno" }),
  ]

  it("makes one node per material and one edge per link that is not discarded", () => {
    const elementos = aElementosDelGrafo(
      materiales,
      [vinculo("a", "b"), vinculo("b", "c", { estado: "sugerido" }), vinculo("a", "c", { estado: "descartado" })],
      [],
      {},
    )

    expect(nodos(elementos).map((e) => e.data.id)).toEqual(["a", "b", "c"])
    expect(aristas(elementos).map((e) => [e.data.source, e.data.target])).toEqual([
      ["a", "b"],
      ["b", "c"],
    ])
  })

  it("colours a node by its category through a token name, never a colour", () => {
    const elementos = aElementosDelGrafo(materiales, [], [], {})

    const apego = nodo(elementos, "a")?.data.token
    const deseo = nodo(elementos, "b")?.data.token
    expect(TOKENS_DE_CATEGORIA).toContain(apego)
    expect(apego).toBe(tokenDeCategoria("Apego"))
    expect(deseo).toBe(nodo(elementos, "c")?.data.token)
    expect(String(apego)).toMatch(/^--grafo-/)
  })

  it("sizes a node by its accepted links only", () => {
    const elementos = aElementosDelGrafo(
      materiales,
      [vinculo("a", "b"), vinculo("a", "c", { estado: "sugerido" })],
      [],
      {},
    )

    const tamano = (id: string) => Number(nodo(elementos, id)?.data.size)
    expect(tamano("a")).toBeGreaterThan(tamano("c"))
    expect(tamano("b")).toBe(tamano("a"))
    expect(tamano("c")).toBeGreaterThan(0)
  })

  it("draws an edge wider the more relevant it is, and dashed while it is only a suggestion", () => {
    const elementos = aElementosDelGrafo(
      materiales,
      [vinculo("a", "b", { relevancia: 5 }), vinculo("b", "c", { relevancia: 1, estado: "sugerido" })],
      [],
      {},
    )

    const [fuerte, debil] = aristas(elementos)
    expect(Number(fuerte?.data.width)).toBeGreaterThan(Number(debil?.data.width))
    expect(fuerte?.data.dashed).toBe(false)
    expect(debil?.data.dashed).toBe(true)
  })

  it("draws theories with another shape and ties them to their materials", () => {
    const elementos = aElementosDelGrafo(
      materiales,
      [],
      [{ id: "t1", nombre: "Teoría del apego", materiales: ["a", "b"] }],
      {},
    )

    expect(nodo(elementos, "t1")?.data).toMatchObject({ tipoDeNodo: "teoria", label: "Teoría del apego" })
    expect(nodo(elementos, "t1")?.data.shape).not.toBe(nodo(elementos, "a")?.data.shape)
    expect(
      aristas(elementos)
        .map((e) => e.data.target)
        .sort(),
    ).toEqual(["a", "b"])
  })

  it("filters by category and drops the edges that lose an end", () => {
    const elementos = aElementosDelGrafo(materiales, [vinculo("a", "b"), vinculo("b", "c")], [], { categoria: "Deseo" })

    expect(nodos(elementos).map((e) => e.data.id)).toEqual(["b", "c"])
    expect(aristas(elementos).map((e) => e.data.id)).toEqual(["b|c"])
  })

  it("filters by author", () => {
    const elementos = aElementosDelGrafo(materiales, [vinculo("a", "c"), vinculo("a", "b")], [], {
      autor: "Autora Uno",
    })

    expect(nodos(elementos).map((e) => e.data.id)).toEqual(["a", "c"])
    expect(aristas(elementos)).toHaveLength(1)
  })

  it("filters by link type and by minimum relevance", () => {
    const vinculos = [
      vinculo("a", "b", { tipo: "contradice", relevancia: 4 }),
      vinculo("b", "c", { tipo: "complementa", relevancia: 2 }),
      vinculo("a", "c", { tipo: "contradice", relevancia: 1 }),
    ]

    expect(aristas(aElementosDelGrafo(materiales, vinculos, [], { tipo: "contradice" }))).toHaveLength(2)
    expect(
      aristas(aElementosDelGrafo(materiales, vinculos, [], { relevanciaMinima: 3 })).map((e) => e.data.id),
    ).toEqual(["a|b"])
    expect(
      aristas(aElementosDelGrafo(materiales, vinculos, [], { tipo: "contradice", relevanciaMinima: 2 })),
    ).toHaveLength(1)
  })

  it("ignores a link whose material is not in the list", () => {
    const elementos = aElementosDelGrafo(materiales, [vinculo("a", "zzz")], [], {})

    expect(aristas(elementos)).toEqual([])
  })

  it("carries the reason and both quotes on the edge for the sheet", () => {
    const elementos = aElementosDelGrafo(
      materiales,
      [vinculo("a", "b", { razon: "Hablan de lo mismo", cita_a: "Cita A", cita_b: "Cita B" })],
      [],
      {},
    )

    expect(aristas(elementos)[0]?.data).toMatchObject({ razon: "Hablan de lo mismo", citaA: "Cita A", citaB: "Cita B" })
  })
})
