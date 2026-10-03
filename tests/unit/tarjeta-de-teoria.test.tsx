import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TarjetaDeTeoria } from "@/app/(app)/teorias/tarjeta-de-teoria"
import type { TeoriaLeida } from "@/lib/ingesta/modelo-de-teoria"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/app/(app)/teorias/acciones", () => ({
  pedirTeoriaAccion: vi.fn(),
  reintentarTeoriaAccion: vi.fn(),
  guardarTeoriaAccion: vi.fn(),
}))

const base: TeoriaLeida = {
  id: "t-1",
  titulo: "El deseo se conversa",
  tesis: "Tesis.",
  argumentos: [],
  contradicciones: [],
  categoriaId: null,
  estado: "guardada",
  motivoFallo: null,
  fuentes: [
    { id: "a", titulo: "Uno" },
    { id: "b", titulo: "Dos" },
  ],
}

const renderizar = (extra: Partial<TeoriaLeida>) =>
  render(
    <ul>
      <TarjetaDeTeoria teoria={{ ...base, ...extra }} />
    </ul>,
  )

describe("TarjetaDeTeoria", () => {
  it("links to the theory with its title, its state and how many sources it has", () => {
    renderizar({})

    expect(screen.getByRole("link", { name: /El deseo se conversa/ })).toHaveAttribute("href", "/teorias/t-1")
    expect(screen.getByText("Guardada")).toBeInTheDocument()
    expect(screen.getByText("2 fuentes")).toBeInTheDocument()
  })

  it("calls a theory with no title yet by what it is doing", () => {
    renderizar({ titulo: null, estado: "sintetizando" })

    expect(screen.getByText("Armando la teoría")).toBeInTheDocument()
    expect(screen.getByText("Armándose")).toBeInTheDocument()
  })

  it("shows the reason and a retry for a theory that did not come out", () => {
    renderizar({ titulo: null, estado: "fallida", motivoFallo: "No pude iniciar la síntesis. Reintenta." })

    expect(screen.getByText("No pude iniciar la síntesis. Reintenta.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })
})
