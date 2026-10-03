import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { excluirAfirmacionAccion } from "@/app/(app)/temas/acciones"
import { BotonOcultar } from "@/app/(app)/temas/boton-ocultar"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/temas/acciones", () => ({ excluirAfirmacionAccion: vi.fn() }))

const excluir = vi.mocked(excluirAfirmacionAccion)
const ID = "11111111-2222-4333-8444-555555555555"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("BotonOcultar", () => {
  it("hides a visible claim through the action and refreshes", async () => {
    excluir.mockResolvedValue({ ok: true })
    render(<BotonOcultar afirmacionId={ID} oculta={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(excluir).toHaveBeenCalledWith({ id: ID, excluida: true })
  })

  it("shows a hidden claim again", async () => {
    excluir.mockResolvedValue({ ok: true })
    render(<BotonOcultar afirmacionId={ID} oculta />)

    fireEvent.click(screen.getByRole("button", { name: "Mostrar" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(excluir).toHaveBeenCalledWith({ id: ID, excluida: false })
  })

  it("says why it failed and does not refresh", async () => {
    excluir.mockResolvedValue({ ok: false, error: "Esa afirmación ya no existe." })
    render(<BotonOcultar afirmacionId={ID} oculta={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Esa afirmación ya no existe.")
    expect(refrescar).not.toHaveBeenCalled()
  })
})
