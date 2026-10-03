import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TarjetaDeTema } from "@/app/(app)/temas/tarjeta-de-tema"
import type { TemaResumido } from "@/lib/ingesta/temas"

const TEMA: TemaResumido = {
  id: "t1",
  nombre: "Apego adulto",
  descripcion: "Cómo se vive el apego.",
  categoriaId: null,
  afirmaciones: 6,
  autores: 3,
  evidencia: { clinica: 1, estudio: 4 },
  cubiertoPorConi: false,
}

describe("TarjetaDeTema", () => {
  it("links to the topic and counts claims and authors", () => {
    render(<TarjetaDeTema tema={TEMA} />)

    expect(screen.getByRole("link", { name: /Apego adulto/ })).toHaveAttribute("href", "/temas/t1")
    expect(screen.getByText("6 afirmaciones · 3 autores")).toBeInTheDocument()
  })

  it("shows the evidence mix as small counts, the most frequent first", () => {
    render(<TarjetaDeTema tema={TEMA} />)

    expect(screen.getByText("Estudio 4 · Clínica 1")).toBeInTheDocument()
  })

  it("badges a topic Coni already covered", () => {
    render(<TarjetaDeTema tema={{ ...TEMA, cubiertoPorConi: true }} />)

    expect(screen.getByText("Coni ya lo trató")).toBeInTheDocument()
  })

  it("badges a topic with a single author and says it in singular", () => {
    render(<TarjetaDeTema tema={{ ...TEMA, autores: 1, afirmaciones: 1 }} />)

    expect(screen.getByText("Un solo autor")).toBeInTheDocument()
    expect(screen.getByText("1 afirmación · 1 autor")).toBeInTheDocument()
  })

  it("has no badges for a topic with several authors that Coni has not covered", () => {
    render(<TarjetaDeTema tema={TEMA} />)

    expect(screen.queryByText("Coni ya lo trató")).toBeNull()
    expect(screen.queryByText("Un solo autor")).toBeNull()
  })
})
