import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { proponerAhoraAccion } from "@/app/(app)/semana/acciones"
import { BotonProponerAhora } from "@/app/(app)/semana/boton-proponer-ahora"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/semana/acciones", () => ({ proponerAhoraAccion: vi.fn() }))

const proponer = vi.mocked(proponerAhoraAccion)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("BotonProponerAhora", () => {
  it("asks the engine and says the ideas are on their way, then refreshes the page", async () => {
    proponer.mockResolvedValue({ ok: true })
    render(<BotonProponerAhora />)

    fireEvent.click(screen.getByRole("button", { name: "Proponer ahora" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(proponer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status")).toHaveTextContent("El motor se puso a trabajar")
  })

  it("shows why it did not start, as an alert, and does not refresh", async () => {
    proponer.mockResolvedValue({
      ok: false,
      error: "El motor ya propuso ideas esta semana. Puedes pedir otras desde el lunes.",
    })
    render(<BotonProponerAhora />)

    fireEvent.click(screen.getByRole("button", { name: "Proponer ahora" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El motor ya propuso ideas esta semana. Puedes pedir otras desde el lunes.",
    )
    expect(refrescar).not.toHaveBeenCalled()
  })

  it("does not ask twice while the first request is going", async () => {
    proponer.mockReturnValue(new Promise(() => {}))
    render(<BotonProponerAhora />)

    fireEvent.click(screen.getByRole("button", { name: "Proponer ahora" }))
    fireEvent.click(screen.getByRole("button", { name: "Proponer ahora" }))

    expect(proponer).toHaveBeenCalledTimes(1)
  })
})
