import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BarraDeSintesis } from "@/app/(app)/grafo/barra-de-sintesis"
import { pedirTeoriaAccion } from "@/app/(app)/teorias/acciones"

const empujar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: empujar }) }))
vi.mock("@/app/(app)/teorias/acciones", () => ({
  pedirTeoriaAccion: vi.fn(),
  reintentarTeoriaAccion: vi.fn(),
  guardarTeoriaAccion: vi.fn(),
}))

const pedir = vi.mocked(pedirTeoriaAccion)
const A = "11111111-2222-4333-8444-555555555551"
const B = "11111111-2222-4333-8444-555555555552"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("BarraDeSintesis", () => {
  it("says how many materials are chosen and keeps Sintetizar off until there are two", () => {
    const { rerender } = render(<BarraDeSintesis seleccionados={[A]} alCancelar={vi.fn()} />)

    expect(screen.getByText("Elige al menos 2 materiales (llevas 1).")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sintetizar" })).toHaveAttribute("aria-disabled", "true")

    rerender(<BarraDeSintesis seleccionados={[A, B]} alCancelar={vi.fn()} />)

    expect(screen.getByText("2 materiales elegidos.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sintetizar" })).not.toHaveAttribute("aria-disabled")
  })

  it("asks for the theory with the chosen ids and opens it", async () => {
    pedir.mockResolvedValue({ ok: true, teoriaId: "t-1" })
    render(<BarraDeSintesis seleccionados={[A, B]} alCancelar={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "Sintetizar" }))

    await waitFor(() => expect(empujar).toHaveBeenCalledWith("/teorias/t-1"))
    expect(pedir).toHaveBeenCalledWith({ materialIds: [A, B] })
  })

  it("shows the reason and stays when the theory could not be asked for", async () => {
    pedir.mockResolvedValue({ ok: false, error: "Solo se pueden usar materiales listos y con ficha." })
    render(<BarraDeSintesis seleccionados={[A, B]} alCancelar={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "Sintetizar" }))

    expect(await screen.findByText("Solo se pueden usar materiales listos y con ficha.")).toBeInTheDocument()
    expect(empujar).not.toHaveBeenCalled()
  })

  it("does not ask while it is under two", () => {
    render(<BarraDeSintesis seleccionados={[A]} alCancelar={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "Sintetizar" }))

    expect(pedir).not.toHaveBeenCalled()
  })

  it("lets her leave the selection", () => {
    const cancelar = vi.fn()
    render(<BarraDeSintesis seleccionados={[]} alCancelar={cancelar} />)

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(cancelar).toHaveBeenCalled()
  })
})
