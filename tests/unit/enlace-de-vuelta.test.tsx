import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { EnlaceDeVuelta } from "@/components/enlace-de-vuelta"

describe("EnlaceDeVuelta", () => {
  it("is Conidolly's quiet action: underlined, with a 2.75rem target", () => {
    render(<EnlaceDeVuelta href="/temas">Temas</EnlaceDeVuelta>)

    const enlace = screen.getByRole("link", { name: "← Temas" })
    expect(enlace).toHaveAttribute("href", "/temas")
    for (const clase of ["underline", "min-h-objetivo", "text-tinta"]) {
      expect(enlace).toHaveClass(clase)
    }
  })
})
