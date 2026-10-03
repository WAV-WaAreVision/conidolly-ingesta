import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BorrarAutor } from "@/app/(app)/autores/[id]/borrar-autor"
import { borrarAutorAccion } from "@/app/(app)/autores/acciones"

const irA = vi.fn()
const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: irA, refresh: refrescar }) }))
vi.mock("@/app/(app)/autores/acciones", () => ({ borrarAutorAccion: vi.fn() }))

const borrar = vi.mocked(borrarAutorAccion)
const AUTOR = { id: "11111111-2222-4333-8444-555555555551", nombre: "Brené B." }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("BorrarAutor", () => {
  it("explains inside the page what happens and calls nothing until she confirms", () => {
    const confirmar = vi.spyOn(window, "confirm")
    render(<BorrarAutor autor={AUTOR} />)

    fireEvent.click(screen.getByRole("button", { name: "Borrar autor" }))

    expect(screen.getByText(/Brené B\. deja de existir como autor\. No se puede deshacer\./)).toBeInTheDocument()
    expect(borrar).not.toHaveBeenCalled()
    expect(confirmar).not.toHaveBeenCalled()
  })

  it("moves focus into the confirmation when it opens and back to the trigger when she cancels", () => {
    render(<BorrarAutor autor={AUTOR} />)

    fireEvent.click(screen.getByRole("button", { name: "Borrar autor" }))
    expect(screen.getByRole("button", { name: "Sí, borrar" })).toHaveFocus()

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("button", { name: "Sí, borrar" })).toBeNull()
    expect(screen.getByRole("button", { name: "Borrar autor" })).toHaveFocus()
    expect(borrar).not.toHaveBeenCalled()
  })

  it("deletes through the action and goes to the authors list", async () => {
    borrar.mockResolvedValue({ ok: true })
    render(<BorrarAutor autor={AUTOR} />)
    fireEvent.click(screen.getByRole("button", { name: "Borrar autor" }))

    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith("/autores"))
    expect(borrar).toHaveBeenCalledWith({ id: AUTOR.id })
    expect(refrescar).toHaveBeenCalled()
  })

  it("shows the error of the server without leaving and stays open", async () => {
    borrar.mockResolvedValue({ ok: false, error: "No se puede borrar: este autor tiene materiales." })
    render(<BorrarAutor autor={AUTOR} />)
    fireEvent.click(screen.getByRole("button", { name: "Borrar autor" }))

    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("No se puede borrar: este autor tiene materiales.")
    expect(irA).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Sí, borrar" })).toBeInTheDocument()
  })
})
