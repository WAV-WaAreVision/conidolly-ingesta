import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { VistaDeSemana } from "@/app/(app)/semana/vista-de-semana"
import type { SemanaLeida } from "@/lib/ingesta/semana"

const ID_UNO = "11111111-2222-4333-8444-555555555551"
const ID_DOS = "11111111-2222-4333-8444-555555555552"

const corrida = {
  semana: "2026-10-04",
  estado: "lista",
  costoUsd: 1.2345,
  ideas: 9,
  manual: false,
  motivoFallo: null,
  terminadaEn: "2026-10-04T23:10:00Z",
  creadaEn: "2026-10-04T23:00:00Z",
} satisfies NonNullable<SemanaLeida["corrida"]>

const base: SemanaLeida = {
  corrida,
  teorias: [
    {
      id: "t1",
      titulo: "El apego explica el deseo",
      tesis: "Quien se siente seguro desea más.",
      puntaje: 0.82,
      nivelEvidencia: "alto",
      temas: [
        { id: ID_UNO, nombre: "Apego" },
        { id: ID_DOS, nombre: "Deseo" },
      ],
    },
  ],
  descartadas: [
    {
      id: "d1",
      razon: "Los autores no se refieren a lo mismo",
      puntaje: 0.4,
      temas: [{ id: ID_DOS, nombre: "Deseo" }],
    },
  ],
  queSubir: { unSoloAutor: ["Celos"], pilaresSinMaterial: ["IA y salud mental"] },
}

describe("VistaDeSemana", () => {
  it("tells Coni the engine has not run yet, and when the first batch comes", () => {
    render(<VistaDeSemana semana={{ corrida: null, teorias: [], descartadas: [], queSubir: null }} />)

    expect(
      screen.getByText("Todavía no corre el motor. La primera tanda llega el domingo a las 20:00."),
    ).toBeInTheDocument()
  })

  it("summarises the latest run: date, state, number of ideas and cost", () => {
    render(<VistaDeSemana semana={base} />)

    const resumen = screen.getByRole("region", { name: "Última corrida" })
    expect(within(resumen).getByText(/4 de octubre/)).toBeInTheDocument()
    expect(within(resumen).getByText("Lista")).toBeInTheDocument()
    expect(within(resumen).getByText("9 ideas")).toBeInTheDocument()
    expect(within(resumen).getByText("US$ 1,23")).toBeInTheDocument()
  })

  it("says one idea in the singular and a failed run with its reason", () => {
    render(
      <VistaDeSemana
        semana={{
          ...base,
          corrida: { ...corrida, ideas: 1, estado: "fallida", motivoFallo: "Claude no respondió" },
        }}
      />,
    )

    expect(screen.getByText("1 idea")).toBeInTheDocument()
    expect(screen.getByText("Falló")).toBeInTheDocument()
    expect(screen.getByText("Claude no respondió")).toBeInTheDocument()
  })

  it("shows each written theory with title, thesis, score, evidence level and its topics linked", () => {
    render(<VistaDeSemana semana={base} />)

    const teoria = screen.getByRole("listitem", { name: "El apego explica el deseo" })
    expect(within(teoria).getByText("Quien se siente seguro desea más.")).toBeInTheDocument()
    expect(within(teoria).getByText("Puntaje 0,82")).toBeInTheDocument()
    expect(within(teoria).getByText("Evidencia alta")).toBeInTheDocument()
    expect(within(teoria).getByRole("link", { name: "Apego" })).toHaveAttribute("href", `/temas/${ID_UNO}`)
    expect(within(teoria).getByRole("link", { name: "Deseo" })).toHaveAttribute("href", `/temas/${ID_DOS}`)
  })

  it("lists the crossings the engine discarded with their reason", () => {
    render(<VistaDeSemana semana={base} />)

    const descartadas = screen.getByRole("region", { name: "Cruces descartados" })
    expect(within(descartadas).getByRole("link", { name: "Deseo" })).toBeInTheDocument()
    expect(within(descartadas).getByText("Los autores no se refieren a lo mismo")).toBeInTheDocument()
  })

  it("leaves out the discarded section when nothing was discarded", () => {
    render(<VistaDeSemana semana={{ ...base, descartadas: [] }} />)

    expect(screen.queryByRole("region", { name: "Cruces descartados" })).toBeNull()
  })

  it("shows what to upload next: topics with one author and pillars without material", () => {
    render(<VistaDeSemana semana={base} />)

    const subir = screen.getByRole("region", { name: "Qué subir después" })
    expect(within(subir).getByText("Celos")).toBeInTheDocument()
    expect(within(subir).getByText("IA y salud mental")).toBeInTheDocument()
  })

  it("says there is nothing to add when every topic has several authors and every pillar has material", () => {
    render(<VistaDeSemana semana={{ ...base, queSubir: { unSoloAutor: [], pilaresSinMaterial: [] } }} />)

    expect(
      screen.getByText("Por ahora no falta nada: cada tema tiene varios autores y cada pilar tiene material."),
    ).toBeInTheDocument()
  })

  it("says the run wrote no theories when it ran but found none", () => {
    render(<VistaDeSemana semana={{ ...base, teorias: [], descartadas: [] }} />)

    expect(screen.getByText("Esta corrida no escribió teorías.")).toBeInTheDocument()
  })
})
