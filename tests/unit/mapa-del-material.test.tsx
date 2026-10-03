import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MapaDelMaterial } from "@/app/(app)/materiales/[id]/mapa-del-material"
import type { MapaDelMaterial as Mapa } from "@/lib/ingesta/materiales"

const MAPA: Mapa = {
  total: 12,
  temas: [
    { id: "t1", nombre: "Apego adulto", afirmaciones: 8 },
    { id: "t2", nombre: "Deseo", afirmaciones: 2 },
  ],
  sinTema: 2,
  tipos: { consejo: 5, definicion: 4, mito: 3 },
  evidencia: { clinica: 7, estudio: 3, opinion: 2 },
}

describe("MapaDelMaterial", () => {
  it("counts the claims and lists each topic with how many of them it holds", () => {
    render(<MapaDelMaterial mapa={MAPA} estado="listo" />)

    expect(screen.getByRole("heading", { name: "Mapa del material" })).toBeInTheDocument()
    expect(screen.getByText("12 afirmaciones")).toBeInTheDocument()
    const temas = within(screen.getByRole("list", { name: "Temas" })).getAllByRole("listitem")
    expect(temas.map((tema) => tema.textContent)).toEqual(["Apego adulto8", "Deseo2", "Sin tema todavía2"])
  })

  it("shows the types of claim and the mix of evidence, the most frequent first", () => {
    render(<MapaDelMaterial mapa={MAPA} estado="listo" />)

    const tipos = within(screen.getByRole("list", { name: "Tipos de afirmación" })).getAllByRole("listitem")
    expect(tipos.map((tipo) => tipo.textContent)).toEqual(["Consejo5", "Definición4", "Mito3"])
    const evidencia = within(screen.getByRole("list", { name: "Evidencia" })).getAllByRole("listitem")
    expect(evidencia.map((tipo) => tipo.textContent)).toEqual(["Clínica7", "Estudio3", "Opinión2"])
  })

  it("says one claim in the singular and leaves out the topics line when none is pending", () => {
    render(
      <MapaDelMaterial
        mapa={{
          total: 1,
          temas: [{ id: "t1", nombre: "Deseo", afirmaciones: 1 }],
          sinTema: 0,
          tipos: { dato: 1 },
          evidencia: { opinion: 1 },
        }}
        estado="listo"
      />,
    )

    expect(screen.getByText("1 afirmación")).toBeInTheDocument()
    expect(screen.queryByText(/Sin tema todavía/)).toBeNull()
  })

  it("says a ready material produced no claims", () => {
    render(<MapaDelMaterial mapa={{ total: 0, temas: [], sinTema: 0, tipos: {}, evidencia: {} }} estado="listo" />)

    expect(screen.getByText("Este material no produjo afirmaciones.")).toBeInTheDocument()
  })

  it("says the map appears when the material finishes processing", () => {
    render(<MapaDelMaterial mapa={{ total: 0, temas: [], sinTema: 0, tipos: {}, evidencia: {} }} estado="procesando" />)

    expect(screen.getByText("El mapa aparece cuando termina de procesarse.")).toBeInTheDocument()
  })
})
