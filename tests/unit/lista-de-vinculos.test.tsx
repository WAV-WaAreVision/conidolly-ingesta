import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { aceptarVinculoAccion, cambiarRelevanciaAccion, descartarVinculoAccion } from "@/app/(app)/grafo/acciones"
import { ListaDeVinculos } from "@/app/(app)/grafo/lista-de-vinculos"
import type { VinculoDelGrafo } from "@/lib/ingesta/grafo"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/grafo/acciones", () => ({
  aceptarVinculoAccion: vi.fn(),
  descartarVinculoAccion: vi.fn(),
  cambiarRelevanciaAccion: vi.fn(),
  crearVinculoAccion: vi.fn(),
}))

const aceptar = vi.mocked(aceptarVinculoAccion)
const descartar = vi.mocked(descartarVinculoAccion)
const relevancia = vi.mocked(cambiarRelevanciaAccion)
const A = "11111111-2222-4333-8444-555555555551"
const B = "11111111-2222-4333-8444-555555555552"
const C = "11111111-2222-4333-8444-555555555553"
const titulos = { [A]: "Apego adulto", [B]: "Deseo y distancia", [C]: "Límites sanos" }
const vinculo = (extra: Partial<VinculoDelGrafo> = {}): VinculoDelGrafo => ({
  material_a: A,
  material_b: B,
  tipo: "complementa",
  relevancia: 3,
  estado: "sugerido",
  razon: "Los dos hablan de la distancia en la pareja.",
  cita_a: null,
  cita_b: null,
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ListaDeVinculos", () => {
  it("lists each link as a row with both titles, the type and the state", () => {
    render(
      <ListaDeVinculos
        vinculos={[vinculo(), vinculo({ material_b: C, estado: "aceptado", tipo: "amplia" })]}
        titulos={titulos}
      />,
    )

    const filas = screen.getAllByRole("listitem")
    expect(filas).toHaveLength(2)
    expect(within(filas[0] as HTMLElement).getByText("Apego adulto")).toBeInTheDocument()
    expect(within(filas[0] as HTMLElement).getByText("Deseo y distancia")).toBeInTheDocument()
    expect(within(filas[0] as HTMLElement).getByText("Complementa")).toBeInTheDocument()
    expect(within(filas[0] as HTMLElement).getByText("Sugerido")).toBeInTheDocument()
    expect(within(filas[1] as HTMLElement).getByText("Aceptado")).toBeInTheDocument()
  })

  it("offers Aceptar only on a suggestion and Descartar on any link", () => {
    render(<ListaDeVinculos vinculos={[vinculo(), vinculo({ material_b: C, estado: "aceptado" })]} titulos={titulos} />)

    const [sugerido, aceptado] = screen.getAllByRole("listitem") as [HTMLElement, HTMLElement]
    expect(within(sugerido).getByRole("button", { name: "Aceptar" })).toBeInTheDocument()
    expect(within(aceptado).queryByRole("button", { name: "Aceptar" })).toBeNull()
    expect(within(aceptado).getByRole("button", { name: "Descartar" })).toBeInTheDocument()
  })

  it("accepts a suggestion and refreshes", async () => {
    aceptar.mockResolvedValue({ ok: true })
    render(<ListaDeVinculos vinculos={[vinculo()]} titulos={titulos} />)

    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }))

    await waitFor(() => expect(aceptar).toHaveBeenCalledWith({ materialA: A, materialB: B }))
    await waitFor(() => expect(refrescar).toHaveBeenCalled())
  })

  it("discards a link and refreshes", async () => {
    descartar.mockResolvedValue({ ok: true })
    render(<ListaDeVinculos vinculos={[vinculo()]} titulos={titulos} />)

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }))

    await waitFor(() => expect(descartar).toHaveBeenCalledWith({ materialA: A, materialB: B }))
    await waitFor(() => expect(refrescar).toHaveBeenCalled())
  })

  it("changes the relevance with the select", async () => {
    relevancia.mockResolvedValue({ ok: true })
    render(<ListaDeVinculos vinculos={[vinculo()]} titulos={titulos} />)

    fireEvent.change(screen.getByLabelText("Relevancia"), { target: { value: "5" } })

    await waitFor(() => expect(relevancia).toHaveBeenCalledWith({ materialA: A, materialB: B, relevancia: 5 }))
    await waitFor(() => expect(refrescar).toHaveBeenCalled())
  })

  it("shows the error of the action and does not refresh", async () => {
    aceptar.mockResolvedValue({ ok: false, error: "Ese vínculo ya no existe." })
    render(<ListaDeVinculos vinculos={[vinculo()]} titulos={titulos} />)

    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese vínculo ya no existe.")
    expect(refrescar).not.toHaveBeenCalled()
  })

  it("says there are no links yet", () => {
    render(<ListaDeVinculos vinculos={[]} titulos={titulos} />)

    expect(
      screen.getByText("Todavía no hay vínculos. Puedes elegir materiales para sintetizar una teoría."),
    ).toBeInTheDocument()
  })
})
