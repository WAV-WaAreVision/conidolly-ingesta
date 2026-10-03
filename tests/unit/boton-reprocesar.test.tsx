import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BotonReprocesar } from "@/app/(app)/materiales/[id]/boton-reprocesar"
import { reprocesarMaterialAccion } from "@/app/(app)/materiales/acciones"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/materiales/acciones", () => ({ reprocesarMaterialAccion: vi.fn() }))

const reprocesar = vi.mocked(reprocesarMaterialAccion)
const ID = "11111111-2222-4333-8444-555555555555"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("BotonReprocesar", () => {
  it("explains inside the page that it costs about the same as the first time, without window.confirm", () => {
    const confirmar = vi.spyOn(window, "confirm")
    render(<BotonReprocesar materialId={ID} />)

    fireEvent.click(screen.getByRole("button", { name: "Reprocesar" }))

    expect(screen.getByText(/cuesta más o menos lo mismo que la primera vez/)).toBeInTheDocument()
    expect(reprocesar).not.toHaveBeenCalled()
    expect(confirmar).not.toHaveBeenCalled()
  })

  it("reprocesses through the action and refreshes the page", async () => {
    reprocesar.mockResolvedValue({ ok: true })
    render(<BotonReprocesar materialId={ID} />)

    fireEvent.click(screen.getByRole("button", { name: "Reprocesar" }))
    fireEvent.click(screen.getByRole("button", { name: "Sí, reprocesar" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(reprocesar).toHaveBeenCalledWith({ materialId: ID })
  })

  it("can be dismissed without reprocessing", () => {
    render(<BotonReprocesar materialId={ID} />)
    fireEvent.click(screen.getByRole("button", { name: "Reprocesar" }))

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByRole("button", { name: "Sí, reprocesar" })).toBeNull()
    expect(reprocesar).not.toHaveBeenCalled()
  })

  it("says why it could not start and does not refresh", async () => {
    reprocesar.mockResolvedValue({ ok: false, error: "Ese material no se puede reprocesar ahora." })
    render(<BotonReprocesar materialId={ID} />)
    fireEvent.click(screen.getByRole("button", { name: "Reprocesar" }))

    fireEvent.click(screen.getByRole("button", { name: "Sí, reprocesar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese material no se puede reprocesar ahora.")
    expect(refrescar).not.toHaveBeenCalled()
  })
})
