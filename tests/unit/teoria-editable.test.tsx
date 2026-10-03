import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TeoriaEditable } from "@/app/(app)/teorias/[id]/teoria-editable"
import { guardarTeoriaAccion } from "@/app/(app)/teorias/acciones"
import type { TeoriaLeida } from "@/lib/ingesta/modelo-de-teoria"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/teorias/acciones", () => ({
  pedirTeoriaAccion: vi.fn(),
  reintentarTeoriaAccion: vi.fn(),
  guardarTeoriaAccion: vi.fn(),
}))

const guardar = vi.mocked(guardarTeoriaAccion)
const A = "11111111-2222-4333-8444-555555555551"
const B = "11111111-2222-4333-8444-555555555552"
const CATEGORIAS = [
  { id: "c1", nombre: "Pareja" },
  { id: "c2", nombre: "General" },
]
const TEORIA: TeoriaLeida = {
  id: "t-1",
  titulo: "El deseo se conversa",
  tesis: "El deseo cambia y hablarlo cuida a la pareja.",
  argumentos: [
    { materialId: A, aporte: "Dice que el deseo no es lineal.", cita: "El deseo no es lineal.", ubicacion: "idea 2" },
    { materialId: B, aporte: "Dice que conversar cuida.", cita: "Conversar es cuidar.", ubicacion: "cita 1" },
  ],
  contradicciones: [{ materialIds: [A, B], descripcion: "Chocan en el ritmo." }],
  categoriaId: null,
  estado: "borrador",
  motivoFallo: null,
  motivoCodigo: null,
  fuentes: [
    { id: A, titulo: "Libro del deseo" },
    { id: B, titulo: "Charla de pareja" },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TeoriaEditable", () => {
  it("shows the arguments with their source and quote, and the contradictions", () => {
    render(<TeoriaEditable teoria={TEORIA} categorias={CATEGORIAS} />)

    const argumentos = screen.getAllByRole("listitem").filter((li) => li.textContent?.includes("Dice que"))
    expect(argumentos).toHaveLength(2)
    const primero = within(argumentos[0] as HTMLElement)
    expect(primero.getByRole("link", { name: "Libro del deseo" })).toHaveAttribute("href", `/materiales/${A}`)
    expect(primero.getByText("El deseo no es lineal.")).toBeInTheDocument()
    expect(primero.getByText("Dice que el deseo no es lineal.")).toBeInTheDocument()
    expect(screen.getByText("Chocan en el ritmo.")).toBeInTheDocument()
    expect(screen.getByText("Se armó con Libro del deseo y Charla de pareja.")).toBeInTheDocument()
  })

  it("saves the edited title, the thesis and the category through the action", async () => {
    guardar.mockResolvedValue({ ok: true })
    render(<TeoriaEditable teoria={TEORIA} categorias={CATEGORIAS} />)

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Hablar el deseo" } })
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "c1" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith({
        teoriaId: "t-1",
        titulo: "Hablar el deseo",
        tesis: TEORIA.tesis,
        categoriaId: "c1",
      }),
    )
    expect(await screen.findByText("Teoría guardada.")).toBeInTheDocument()
    expect(refrescar).toHaveBeenCalled()
  })

  it("sends no category when none is chosen", async () => {
    guardar.mockResolvedValue({ ok: true })
    render(<TeoriaEditable teoria={TEORIA} categorias={CATEGORIAS} />)

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: null })))
  })

  it("shows the reason when it could not save", async () => {
    guardar.mockResolvedValue({ ok: false, error: "Escribe un título y una tesis." })
    render(<TeoriaEditable teoria={TEORIA} categorias={CATEGORIAS} />)

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe un título y una tesis.")
    expect(refrescar).not.toHaveBeenCalled()
  })

  it("starts from the saved category and says when the theory is already saved", () => {
    render(<TeoriaEditable teoria={{ ...TEORIA, estado: "guardada", categoriaId: "c2" }} categorias={CATEGORIAS} />)

    expect(screen.getByLabelText("Categoría")).toHaveValue("c2")
    expect(screen.getByText("Guardada")).toBeInTheDocument()
  })
})
