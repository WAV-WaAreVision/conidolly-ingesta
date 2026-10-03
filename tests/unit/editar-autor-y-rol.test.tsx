import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EditarAutorYRol } from "@/app/(app)/materiales/[id]/editar-autor-y-rol"
import { editarMaterialAccion } from "@/app/(app)/materiales/acciones"
import { crearAutorAccion } from "@/app/(app)/subir/acciones"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/materiales/acciones", () => ({ editarMaterialAccion: vi.fn() }))
vi.mock("@/app/(app)/subir/acciones", () => ({ crearAutorAccion: vi.fn() }))

const editar = vi.mocked(editarMaterialAccion)
vi.mocked(crearAutorAccion)
const ID = "11111111-2222-4333-8444-555555555555"
const AUTORES = [
  { id: "a1", nombre: "Esther Perel", credencial: null, tipo: "persona", alias: [] },
  { id: "a2", nombre: "Brené Brown", credencial: "Investigadora", tipo: "persona", alias: [] },
]

const abrir = (extra: { conAfirmaciones?: boolean } = {}) => {
  render(
    <EditarAutorYRol
      materialId={ID}
      autores={AUTORES}
      autorId="a1"
      rol="referente"
      conAfirmaciones={false}
      {...extra}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Cambiar autor o papel" }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("EditarAutorYRol", () => {
  it("starts closed and opens with the current author and role selected", () => {
    render(<EditarAutorYRol materialId={ID} autores={AUTORES} autorId="a1" rol="referente" conAfirmaciones={false} />)
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Cambiar autor o papel" }))

    expect(screen.getByText("Esther Perel")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Referente/ })).toBeChecked()
  })

  it("saves the other author and role through the action and refreshes", async () => {
    editar.mockResolvedValue({ ok: true })
    abrir()

    fireEvent.click(screen.getByRole("button", { name: "Cambiar autor" }))
    fireEvent.click(screen.getByRole("button", { name: /Brené Brown/ }))
    fireEvent.click(screen.getByRole("radio", { name: /Estudio o libro/ }))
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(editar).toHaveBeenCalledWith({ materialId: ID, autorId: "a2", rol: "evidencia" })
  })

  it("tells her to reprocess when claims were already taken out with the old author", async () => {
    editar.mockResolvedValue({ ok: true })
    abrir({ conAfirmaciones: true })

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    expect(
      await screen.findByText(/Reprocesa el material para que sus afirmaciones usen el cambio/),
    ).toBeInTheDocument()
  })

  it("does not mention reprocessing when there are no claims yet", async () => {
    editar.mockResolvedValue({ ok: true })
    abrir({ conAfirmaciones: false })

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(screen.queryByText(/Reprocesa el material/)).toBeNull()
  })

  it("says why it could not save and stays open", async () => {
    editar.mockResolvedValue({ ok: false, error: "No encontré ese material." })
    abrir()

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("No encontré ese material.")
    expect(refrescar).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument()
  })

  it("closes without saving", () => {
    abrir()

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull()
    expect(editar).not.toHaveBeenCalled()
  })
})
