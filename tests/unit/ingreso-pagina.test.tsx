import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Ingreso from "@/app/ingreso/page"

vi.mock("@/app/ingreso/acciones", () => ({ pedirCodigoAccion: vi.fn(), verificarCodigoAccion: vi.fn() }))

describe("the sign-in page", () => {
  it("says the Biblioteca link was used or expired when the bridge sends her back", async () => {
    render(await Ingreso({ searchParams: Promise.resolve({ puente: "vencido" }) }))

    expect(screen.getByRole("status")).toHaveTextContent(
      "El enlace ya se usó o venció. Vuelve a Conidolly y toca Biblioteca otra vez.",
    )
    // She can still sign in with her code.
    expect(screen.getByRole("button", { name: "Soy Coni" })).toBeInTheDocument()
  })

  it("says nothing about the bridge on a normal visit", async () => {
    render(await Ingreso({ searchParams: Promise.resolve({}) }))

    expect(screen.queryByText(/El enlace ya se usó/)).not.toBeInTheDocument()
  })
})
