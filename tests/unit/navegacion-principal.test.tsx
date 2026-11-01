import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NavegacionPrincipal } from "@/components/navegacion-principal"

describe("NavegacionPrincipal", () => {
  it("links Materiales, Autores and Temas and marks the current one", () => {
    render(<NavegacionPrincipal actual="autores" rol="coni" />)

    expect(screen.getByRole("link", { name: "Materiales" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Autores" })).toHaveAttribute("href", "/autores")
    expect(screen.getByRole("link", { name: "Temas" })).toHaveAttribute("href", "/temas")
    expect(screen.getByRole("link", { name: "Autores" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Temas" })).not.toHaveAttribute("aria-current")
  })

  it("shows Datos to WAV only", () => {
    const { unmount } = render(<NavegacionPrincipal actual="materiales" rol="coni" />)
    expect(screen.queryByRole("link", { name: "Datos" })).toBeNull()
    unmount()

    render(<NavegacionPrincipal actual="datos" rol="wav" />)
    expect(screen.getByRole("link", { name: "Datos" })).toHaveAttribute("href", "/datos-personales")
    expect(screen.getByRole("link", { name: "Datos" })).toHaveAttribute("aria-current", "page")
  })
})
