import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FichaEditable } from "@/app/(app)/materiales/[id]/ficha-editable"
import { editarFichaAccion } from "@/app/(app)/materiales/acciones"
import type { FichaLeida } from "@/lib/ingesta/ficha"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/materiales/acciones", () => ({ editarFichaAccion: vi.fn() }))

const editar = vi.mocked(editarFichaAccion)
const ID = "11111111-2222-4333-8444-555555555555"
const FICHA: FichaLeida = {
  resumen: "Un resumen de la charla.",
  ideasClave: ["Idea uno", "Idea dos", "Idea tres", "Idea cuatro", "Idea cinco"],
  citas: [
    { texto: "Primera cita", ubicacion: { pagina: 12 } },
    { texto: "Segunda cita", ubicacion: { segundo: 75, pista: "voz" } },
    { texto: "Tercera cita", ubicacion: { imagen: 2 } },
  ],
  fuente: { autor: "Esther Perel", anio: 2017, enlace: "https://example.com/nota" },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("FichaEditable", () => {
  it("shows the summary, key ideas, quotes with where they are, and the source", () => {
    render(<FichaEditable materialId={ID} ficha={FICHA} />)

    expect(screen.getByText("Un resumen de la charla.")).toBeInTheDocument()
    expect(screen.getByText("Idea tres")).toBeInTheDocument()
    expect(screen.getByText("Primera cita")).toBeInTheDocument()
    expect(screen.getByText("página 12")).toBeInTheDocument()
    expect(screen.getByText("1:15")).toBeInTheDocument()
    expect(screen.getByText("imagen 2")).toBeInTheDocument()
    expect(screen.getByText(/Esther Perel/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "https://example.com/nota" })).toHaveAttribute(
      "href",
      "https://example.com/nota",
    )
  })

  it("saves an edited key idea through the action and goes back to reading", async () => {
    editar.mockResolvedValue({ ok: true })
    render(<FichaEditable materialId={ID} ficha={FICHA} />)

    fireEvent.click(screen.getByRole("button", { name: "Editar" }))
    fireEvent.change(screen.getByLabelText("Idea clave 2"), { target: { value: "Idea dos corregida" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => expect(editar).toHaveBeenCalled())
    expect(editar).toHaveBeenCalledWith({
      materialId: ID,
      resumen: FICHA.resumen,
      ideasClave: ["Idea uno", "Idea dos corregida", "Idea tres", "Idea cuatro", "Idea cinco"],
      citas: FICHA.citas,
      fuente: FICHA.fuente,
    })
    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(screen.queryByLabelText("Idea clave 2")).toBeNull()
  })

  it("removes and adds key ideas as a list, up to ten", () => {
    render(<FichaEditable materialId={ID} ficha={FICHA} />)
    fireEvent.click(screen.getByRole("button", { name: "Editar" }))

    fireEvent.click(screen.getByRole("button", { name: "Quitar la idea clave 1" }))
    expect(screen.queryByLabelText("Idea clave 5")).toBeNull()

    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Agregar una idea clave" }))
    expect(screen.getByLabelText("Idea clave 10")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Agregar una idea clave" })).toBeNull()
  })

  it("does not save with fewer than five ideas and says why", () => {
    render(<FichaEditable materialId={ID} ficha={FICHA} />)
    fireEvent.click(screen.getByRole("button", { name: "Editar" }))
    fireEvent.click(screen.getByRole("button", { name: "Quitar la idea clave 1" }))

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Deja entre 5 y 10 ideas clave.")
    expect(editar).not.toHaveBeenCalled()
  })

  it("shows the server's reason and stays editing when the save fails", async () => {
    editar.mockResolvedValue({ ok: false, error: "No pude guardar los cambios." })
    render(<FichaEditable materialId={ID} ficha={FICHA} />)
    fireEvent.click(screen.getByRole("button", { name: "Editar" }))

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("No pude guardar los cambios.")
    expect(screen.getByLabelText("Idea clave 1")).toBeInTheDocument()
    expect(refrescar).not.toHaveBeenCalled()
  })

  it("edits a quote's text and keeps where it came from", async () => {
    editar.mockResolvedValue({ ok: true })
    render(<FichaEditable materialId={ID} ficha={FICHA} />)
    fireEvent.click(screen.getByRole("button", { name: "Editar" }))

    fireEvent.change(screen.getByLabelText("Texto de la cita 2"), { target: { value: "Segunda cita editada" } })
    fireEvent.click(within(screen.getByRole("group", { name: "Cita 1" })).getByRole("button", { name: "Quitar" }))
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => expect(editar).toHaveBeenCalled())
    expect(editar.mock.calls[0]?.[0]).toMatchObject({
      citas: [
        { texto: "Segunda cita editada", ubicacion: { segundo: 75, pista: "voz" } },
        { texto: "Tercera cita", ubicacion: { imagen: 2 } },
      ],
    })
  })

  it("cancels without saving", () => {
    render(<FichaEditable materialId={ID} ficha={FICHA} />)
    fireEvent.click(screen.getByRole("button", { name: "Editar" }))
    fireEvent.change(screen.getByLabelText("Resumen"), { target: { value: "otro" } })

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(editar).not.toHaveBeenCalled()
    expect(screen.getByText("Un resumen de la charla.")).toBeInTheDocument()
  })
})
