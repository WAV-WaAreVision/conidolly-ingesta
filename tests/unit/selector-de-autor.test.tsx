import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SelectorDeAutor } from "@/components/selector-de-autor"
import type { AutorDeLista } from "@/lib/ingesta/buscar-autor"

const AUTORES: AutorDeLista[] = [
  { id: "a1", nombre: "Esther Perel", credencial: "Psicoterapeuta de parejas", tipo: "persona", alias: ["E. Perel"] },
  { id: "a2", nombre: "Constanza del Rosario", credencial: null, tipo: "coni", alias: [] },
  { id: "a3", nombre: "Instituto Gottman", credencial: null, tipo: "institucion", alias: [] },
]

const crear = vi.fn()
const elegido = vi.fn()

function Selector() {
  const [valor, setValor] = useState("")
  return (
    <SelectorDeAutor
      autores={AUTORES}
      valor={valor}
      alElegir={(id) => {
        elegido(id)
        setValor(id)
      }}
      alCrear={crear}
    />
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("SelectorDeAutor: buscar", () => {
  it("lists the authors with their name and credential, and filters by name or alias as you type", () => {
    render(<Selector />)

    expect(screen.getByRole("button", { name: /Esther Perel.*Psicoterapeuta de parejas/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Instituto Gottman/ })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "e. perel" } })

    expect(screen.getByRole("button", { name: /Esther Perel/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Instituto Gottman/ })).toBeNull()
  })

  it("says nobody matches and offers a new author", () => {
    render(<Selector />)

    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Brené" } })

    expect(screen.getByText("Nadie se llama así todavía.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Autor nuevo" })).toBeInTheDocument()
  })

  it("picks an author and shows who is picked, with a way to change it", () => {
    render(<Selector />)

    fireEvent.click(screen.getByRole("button", { name: /Esther Perel/ }))

    expect(elegido).toHaveBeenCalledWith("a1")
    expect(screen.getByText("Esther Perel")).toBeInTheDocument()
    expect(screen.queryByLabelText("Autor")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Cambiar autor" }))
    expect(screen.getByLabelText("Autor")).toBeInTheDocument()
  })
})

describe("SelectorDeAutor: autor nuevo", () => {
  const abrirNuevo = (nombre = "") => {
    render(<Selector />)
    if (nombre) fireEvent.change(screen.getByLabelText("Autor"), { target: { value: nombre } })
    fireEvent.click(screen.getByRole("button", { name: "Autor nuevo" }))
  }

  it("starts from what was typed and creates the author with name, credential and type", async () => {
    crear.mockResolvedValue({
      ok: true,
      autor: { id: "a9", nombre: "Brené Brown", credencial: "Investigadora", tipo: "persona", alias: [] },
    })
    abrirNuevo("Brené Brown")

    expect(screen.getByLabelText("Nombre del autor")).toHaveValue("Brené Brown")
    fireEvent.change(screen.getByLabelText(/Credencial/), { target: { value: "Investigadora" } })
    fireEvent.change(screen.getByLabelText("Tipo de autor"), { target: { value: "persona" } })
    fireEvent.click(screen.getByRole("button", { name: "Crear autor" }))

    await waitFor(() => expect(elegido).toHaveBeenCalledWith("a9"))
    expect(crear).toHaveBeenCalledWith({ nombre: "Brené Brown", credencial: "Investigadora", tipo: "persona" })
    expect(screen.getByText("Brené Brown")).toBeInTheDocument()
  })

  it("offers person, account and institution, never Coni", () => {
    abrirNuevo()

    const opciones = within(screen.getByLabelText("Tipo de autor")).getAllByRole("option")
    expect(opciones.map((opcion) => opcion.textContent)).toEqual(["Persona", "Cuenta de redes", "Institución"])
  })

  it("asks whether it is the same author when the typed name matches one that exists", () => {
    abrirNuevo()

    fireEvent.change(screen.getByLabelText("Nombre del autor"), { target: { value: "esther perel" } })

    expect(screen.getByText("¿Es el mismo autor que Esther Perel?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Sí, es Esther Perel" }))
    expect(elegido).toHaveBeenCalledWith("a1")
    expect(crear).not.toHaveBeenCalled()
  })

  it("suggests nobody for a name that matches nothing", () => {
    abrirNuevo()

    fireEvent.change(screen.getByLabelText("Nombre del autor"), { target: { value: "Brené Brown" } })

    expect(screen.queryByText(/¿Es el mismo autor que/)).toBeNull()
  })

  it("shows why it could not create the author and stays on the form", async () => {
    crear.mockResolvedValue({ ok: false, error: "Escribe el nombre del autor." })
    abrirNuevo()

    fireEvent.click(screen.getByRole("button", { name: "Crear autor" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe el nombre del autor.")
    expect(elegido).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Nombre del autor")).toBeInTheDocument()
  })

  it("can go back to the search without creating anything", () => {
    abrirNuevo()

    fireEvent.click(screen.getByRole("button", { name: "Volver a buscar" }))

    expect(screen.getByLabelText("Autor")).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })
})
