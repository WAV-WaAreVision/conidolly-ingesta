import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BorrarMaterial } from "@/app/(app)/materiales/[id]/borrar-material"
import { borrarMaterialAccion } from "@/app/(app)/materiales/acciones"

const irA = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: irA, refresh: vi.fn() }) }))
vi.mock("@/app/(app)/materiales/acciones", () => ({ borrarMaterialAccion: vi.fn() }))

const borrar = vi.mocked(borrarMaterialAccion)
const ID = "11111111-2222-4333-8444-555555555555"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("BorrarMaterial", () => {
  it("asks inside the page before deleting, without window.confirm", () => {
    const confirmar = vi.spyOn(window, "confirm")
    render(<BorrarMaterial materialId={ID} />)

    fireEvent.click(screen.getByRole("button", { name: "Borrar material" }))

    expect(screen.getByText(/Se borran también la ficha y los archivos/)).toBeInTheDocument()
    expect(borrar).not.toHaveBeenCalled()
    expect(confirmar).not.toHaveBeenCalled()
  })

  it("goes back to the list once the material is deleted", async () => {
    borrar.mockResolvedValue({ ok: true })
    render(<BorrarMaterial materialId={ID} />)

    fireEvent.click(screen.getByRole("button", { name: "Borrar material" }))
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith("/"))
    expect(borrar).toHaveBeenCalledWith({ materialId: ID })
  })

  it("can be dismissed without deleting", () => {
    render(<BorrarMaterial materialId={ID} />)
    fireEvent.click(screen.getByRole("button", { name: "Borrar material" }))

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByRole("button", { name: "Sí, borrar" })).toBeNull()
    expect(borrar).not.toHaveBeenCalled()
  })

  it("shows why it could not delete and stays on the page", async () => {
    borrar.mockResolvedValue({ ok: false, error: "Solo Coni o quien lo subió puede borrarlo." })
    render(<BorrarMaterial materialId={ID} />)
    fireEvent.click(screen.getByRole("button", { name: "Borrar material" }))

    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Solo Coni o quien lo subió puede borrarlo.")
    expect(irA).not.toHaveBeenCalled()
  })
})
