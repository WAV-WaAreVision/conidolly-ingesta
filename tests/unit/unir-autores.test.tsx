import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnirAutores } from "@/app/(app)/autores/[id]/unir-autores"
import { fusionarAutoresAccion } from "@/app/(app)/autores/acciones"

const irA = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: irA, refresh: vi.fn() }) }))
vi.mock("@/app/(app)/autores/acciones", () => ({ fusionarAutoresAccion: vi.fn() }))

const fusionar = vi.mocked(fusionarAutoresAccion)
const ORIGEN = { id: "11111111-2222-4333-8444-555555555551", nombre: "Brené B." }
const OTROS = [
  { id: "11111111-2222-4333-8444-555555555552", nombre: "Brené Brown" },
  { id: "11111111-2222-4333-8444-555555555553", nombre: "Esther Perel" },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe("UnirAutores", () => {
  it("explains inside the page what happens and calls nothing until she confirms", () => {
    const confirmar = vi.spyOn(window, "confirm")
    render(<UnirAutores origen={ORIGEN} otros={OTROS} />)

    fireEvent.click(screen.getByRole("button", { name: "Unir con otro autor" }))

    expect(screen.getByText(/Sus materiales y afirmaciones pasan al otro autor/)).toBeInTheDocument()
    expect(fusionar).not.toHaveBeenCalled()
    expect(confirmar).not.toHaveBeenCalled()
  })

  it("moves focus to the destination select when the confirmation opens", () => {
    render(<UnirAutores origen={ORIGEN} otros={OTROS} />)

    fireEvent.click(screen.getByRole("button", { name: "Unir con otro autor" }))

    expect(screen.getByLabelText("Unir con")).toHaveFocus()
  })

  it("needs a destination before it merges", async () => {
    render(<UnirAutores origen={ORIGEN} otros={OTROS} />)
    fireEvent.click(screen.getByRole("button", { name: "Unir con otro autor" }))

    fireEvent.click(screen.getByRole("button", { name: "Sí, unir" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Elige con qué autor unirlo.")
    expect(fusionar).not.toHaveBeenCalled()
  })

  it("merges into the chosen author and goes to its page", async () => {
    fusionar.mockResolvedValue({ ok: true })
    render(<UnirAutores origen={ORIGEN} otros={OTROS} />)
    fireEvent.click(screen.getByRole("button", { name: "Unir con otro autor" }))

    fireEvent.change(screen.getByLabelText("Unir con"), { target: { value: OTROS[0]?.id } })
    fireEvent.click(screen.getByRole("button", { name: "Sí, unir" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith(`/autores/${OTROS[0]?.id}`))
    expect(fusionar).toHaveBeenCalledWith({ origen: ORIGEN.id, destino: OTROS[0]?.id })
  })

  it("can be dismissed, and shows the error of the server without leaving", async () => {
    fusionar.mockResolvedValue({ ok: false, error: "Ese autor ya no existe." })
    render(<UnirAutores origen={ORIGEN} otros={OTROS} />)
    fireEvent.click(screen.getByRole("button", { name: "Unir con otro autor" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("button", { name: "Sí, unir" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Unir con otro autor" }))
    fireEvent.change(screen.getByLabelText("Unir con"), { target: { value: OTROS[1]?.id } })
    fireEvent.click(screen.getByRole("button", { name: "Sí, unir" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese autor ya no existe.")
    expect(irA).not.toHaveBeenCalled()
  })
})
