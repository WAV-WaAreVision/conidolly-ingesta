import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ListaParaElegir } from "@/app/(app)/grafo/lista-para-elegir"

const A = "11111111-2222-4333-8444-555555555551"
const B = "11111111-2222-4333-8444-555555555552"
const materiales = [
  { id: A, titulo: "Apego adulto", autor: "Autora", categoria: "Pareja" },
  { id: B, titulo: null, autor: null, categoria: "General" },
]

describe("ListaParaElegir", () => {
  it("shows one checkbox per material, checked for the ones chosen", () => {
    render(<ListaParaElegir materiales={materiales} seleccionados={[B]} alAlternar={vi.fn()} />)

    expect(screen.getByRole("checkbox", { name: /Apego adulto/ })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Sin título/ })).toBeChecked()
  })

  it("tells which material was toggled", () => {
    const alternar = vi.fn()
    render(<ListaParaElegir materiales={materiales} seleccionados={[]} alAlternar={alternar} />)

    fireEvent.click(screen.getByRole("checkbox", { name: /Apego adulto/ }))

    expect(alternar).toHaveBeenCalledWith(A)
  })
})
