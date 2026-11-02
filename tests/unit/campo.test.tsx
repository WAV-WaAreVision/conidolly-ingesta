import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"

describe("Campo", () => {
  it("sinks the field like Conidolly's (the .campo class of globals.css) and labels it in body size", () => {
    render(
      <Campo id="titulo" etiqueta="Título" ayuda="Como lo dice la fuente.">
        <input id="titulo" className={CLASES_DE_CAMPO} aria-describedby="titulo-ayuda" />
      </Campo>,
    )

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveClass("campo", "w-full", "text-cuerpo")
    expect(screen.getByText("Título")).toHaveClass("text-cuerpo", "font-semibold")
    expect(screen.getByText("Como lo dice la fuente.")).toHaveClass("text-meta", "text-apagado")
  })
})
