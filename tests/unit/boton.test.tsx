import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Boton } from "@/components/ui/boton"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"

describe("Boton", () => {
  it("is a raised ink pill by default, pressing sinks it", () => {
    render(<Boton>Subir material</Boton>)

    expect(screen.getByRole("button", { name: "Subir material" })).toHaveClass(
      "rounded-control",
      "bg-tinta",
      "text-luz",
      "shadow-relieve",
      "active:shadow-hundido",
      "min-h-boton",
      "text-boton",
    )
  })

  it("draws the line variant as Conidolly's raised secondary on stone", () => {
    render(<Boton variante="linea">Salir</Boton>)

    expect(screen.getByRole("button", { name: "Salir" })).toHaveClass("bg-piedra", "text-tinta", "shadow-relieve")
  })

  it("draws the quiet variant as underlined ink text on a 2.75rem target, without a surface", () => {
    render(<Boton variante="callado">Cambiar de persona</Boton>)

    const boton = screen.getByRole("button", { name: "Cambiar de persona" })
    expect(boton).toHaveClass("text-tinta", "underline", "min-h-objetivo", "px-0")
    expect(boton).not.toHaveClass("min-h-boton", "shadow-relieve")
  })

  it("stays focusable when disabled and turns flat", () => {
    render(<Boton deshabilitado>Entrar</Boton>)

    const boton = screen.getByRole("button", { name: "Entrar" })
    expect(boton).toHaveAttribute("aria-disabled", "true")
    expect(boton).not.toBeDisabled()
    expect(boton).toHaveClass("aria-disabled:bg-piedra-honda", "aria-disabled:shadow-none")
  })

  it("gives links that look like buttons the same classes", () => {
    expect(clasesDeBoton()).toContain("bg-tinta")
    expect(clasesDeBoton({ variante: "linea", tamano: "chico" })).toContain("min-h-objetivo")
  })
})
