import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FiltrosDeLaLista } from "@/app/(app)/filtros-de-materiales"

const AUTORES = [
  { id: "a1", nombre: "Esther Perel" },
  { id: "a2", nombre: "Constanza del Rosario" },
]

const opciones = (nombre: string) =>
  within(screen.getByLabelText(nombre))
    .getAllByRole("option")
    .map((opcion) => opcion.textContent)

describe("FiltrosDeLaLista", () => {
  it("filters by author, role, type and state, and no longer by category", () => {
    render(<FiltrosDeLaLista filtros={{}} autores={AUTORES} />)

    expect(opciones("Autor")).toEqual(["Todos", "Esther Perel", "Constanza del Rosario"])
    expect(opciones("Papel")).toEqual(["Todos", "Lo dijo Coni", "Referente", "Estudio o libro", "Estrategia interna"])
    expect(opciones("Tipo")).toEqual(["Todos", "Documento", "Link", "Audio", "Video", "Imagen", "Post"])
    expect(opciones("Estado")).toEqual(["Todos", "Procesando", "Listo", "No se pudo procesar"])
    expect(screen.queryByLabelText("Categoría")).toBeNull()
  })

  it("keeps the filters of the URL selected, sending the author by id", () => {
    render(<FiltrosDeLaLista filtros={{ autor: "a2", rol: "evidencia" }} autores={AUTORES} />)

    expect(screen.getByLabelText("Autor")).toHaveValue("a2")
    expect(screen.getByLabelText("Autor")).toHaveAttribute("name", "autor")
    expect(screen.getByLabelText("Papel")).toHaveValue("evidencia")
    expect(screen.getByLabelText("Papel")).toHaveAttribute("name", "rol")
    expect(screen.getByRole("link", { name: "Quitar filtros" })).toBeInTheDocument()
  })
})
