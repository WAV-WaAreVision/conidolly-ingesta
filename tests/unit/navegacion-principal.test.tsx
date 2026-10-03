import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NavegacionPrincipal } from "@/components/navegacion-principal"

describe("NavegacionPrincipal", () => {
  it("links Materiales, Autores and Temas and marks the current one", () => {
    render(<NavegacionPrincipal actual="autores" />)

    expect(screen.getByRole("link", { name: "Materiales" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Autores" })).toHaveAttribute("href", "/autores")
    expect(screen.getByRole("link", { name: "Temas" })).toHaveAttribute("href", "/temas")
    expect(screen.getByRole("link", { name: "Autores" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Temas" })).not.toHaveAttribute("aria-current")
  })
})
