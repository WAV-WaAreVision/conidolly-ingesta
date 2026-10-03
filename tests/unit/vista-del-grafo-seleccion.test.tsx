import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { VistaDelGrafo } from "@/app/(app)/grafo/vista-del-grafo"
import type { MaterialDelGrafo } from "@/lib/ingesta/grafo"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/app/(app)/teorias/acciones", () => ({
  pedirTeoriaAccion: vi.fn(),
  reintentarTeoriaAccion: vi.fn(),
  guardarTeoriaAccion: vi.fn(),
}))
vi.mock("@/app/(app)/grafo/acciones", () => ({
  aceptarVinculoAccion: vi.fn(),
  descartarVinculoAccion: vi.fn(),
  cambiarRelevanciaAccion: vi.fn(),
  crearVinculoAccion: vi.fn(),
}))

interface PropiedadesDelLienzo {
  elementos: unknown[]
  elegidos: string[]
  alTocarNodo: (id: string) => void
}
let lienzo: PropiedadesDelLienzo | undefined
vi.mock("@/app/(app)/grafo/grafo-cytoscape", () => ({
  GrafoCytoscape: (propiedades: PropiedadesDelLienzo) => {
    lienzo = propiedades
    return <div data-testid="grafo" />
  },
}))

const materiales: MaterialDelGrafo[] = Array.from({ length: 10 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  titulo: `Material ${i + 1}`,
  autor: null,
  categoria: "General",
}))
const id = (i: number) => materiales[i]?.id ?? ""
const tocar = (nodo: string) => act(() => lienzo?.alTocarNodo(nodo))

beforeEach(() => {
  lienzo = undefined
})

describe("VistaDelGrafo al elegir materiales", () => {
  it("draws the materials even when nobody has linked them yet, so a theory can start from them", () => {
    render(<VistaDelGrafo materiales={materiales.slice(0, 2)} vinculos={[]} teorias={[]} />)

    expect(screen.getByTestId("grafo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Seleccionar" })).toBeInTheDocument()
  })

  it("says the graph needs two materials when there are fewer", () => {
    render(<VistaDelGrafo materiales={materiales.slice(0, 1)} vinculos={[]} teorias={[]} />)

    expect(screen.queryByTestId("grafo")).not.toBeInTheDocument()
    expect(screen.getByText("Los vínculos aparecen cuando hay al menos dos materiales listos.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Seleccionar" })).not.toBeInTheDocument()
  })

  it("says in the list view that there are no links yet and that she can pick materials, when there are two or more", () => {
    render(<VistaDelGrafo materiales={materiales.slice(0, 2)} vinculos={[]} teorias={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Ver como lista" }))

    expect(
      screen.getByText("Todavía no hay vínculos. Puedes elegir materiales para sintetizar una teoría."),
    ).toBeInTheDocument()
  })

  it("toggles materials by tapping their nodes while choosing, and highlights them", () => {
    render(<VistaDelGrafo materiales={materiales.slice(0, 3)} vinculos={[]} teorias={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar" }))
    expect(screen.getByText("Elige al menos 2 materiales (llevas 0).")).toBeInTheDocument()
    tocar(id(0))
    tocar(id(1))
    expect(screen.queryByText(/llevas/)).not.toBeInTheDocument()
    expect(screen.getByText("2 materiales elegidos.")).toBeInTheDocument()
    expect(lienzo?.elegidos).toEqual([id(0), id(1)])

    tocar(id(0))
    expect(lienzo?.elegidos).toEqual([id(1)])
  })

  it("does not open a card when a node is tapped while choosing", () => {
    render(<VistaDelGrafo materiales={materiales.slice(0, 3)} vinculos={[]} teorias={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar" }))
    tocar(id(0))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("chooses with checkboxes in the list view, up to eight, and says so at the ninth", () => {
    render(<VistaDelGrafo materiales={materiales} vinculos={[]} teorias={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Ver como lista" }))
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar" }))
    for (let i = 0; i < 8; i++)
      fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^Material ${i + 1}\\b`) }))
    expect(screen.getByText("8 materiales elegidos.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("checkbox", { name: /^Material 9\b/ }))

    expect(screen.getByRole("status")).toHaveTextContent("Son 8 materiales como máximo.")
    expect(screen.getByRole("checkbox", { name: /^Material 9\b/ })).not.toBeChecked()
  })

  it("leaves the selection with Cancelar and forgets what was chosen", () => {
    render(<VistaDelGrafo materiales={materiales.slice(0, 3)} vinculos={[]} teorias={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar" }))
    tocar(id(0))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByText(/materiales elegidos|llevas/)).not.toBeInTheDocument()
    expect(lienzo?.elegidos).toEqual([])
  })

  it("opens a card for a saved theory with a link to it", () => {
    const teorias = [{ id: "11111111-2222-4333-8444-555555555599", nombre: "Mi teoría", materiales: [id(0), id(1)] }]
    render(<VistaDelGrafo materiales={materiales.slice(0, 3)} vinculos={[]} teorias={teorias} />)

    tocar("11111111-2222-4333-8444-555555555599")

    expect(screen.getByRole("dialog", { name: "Mi teoría" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver teoría" })).toHaveAttribute(
      "href",
      "/teorias/11111111-2222-4333-8444-555555555599",
    )
  })
})
