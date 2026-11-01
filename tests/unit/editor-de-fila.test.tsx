import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { agregarFilaAccion, confirmarPaisAccion, guardarFilaAccion } from "@/app/(app)/datos-personales/acciones"
import { EditorDeFila } from "@/app/(app)/datos-personales/editor-de-fila"
import type { FilaDelRegistro } from "@/lib/ingesta/datos-personales"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/datos-personales/acciones", () => ({
  guardarFilaAccion: vi.fn(),
  agregarFilaAccion: vi.fn(),
  confirmarPaisAccion: vi.fn(),
}))

const guardar = vi.mocked(guardarFilaAccion)
const agregar = vi.mocked(agregarFilaAccion)
const confirmar = vi.mocked(confirmarPaisAccion)

const FILA: FilaDelRegistro = {
  id: "11111111-2222-4333-8444-555555555555",
  clave: "respaldos",
  dato: "Respaldo nocturno de la base",
  para_que: "Recuperar la app si algo se pierde.",
  proveedor: "Cloudflare R2",
  pais: "Por confirmar",
  pais_confirmado: false,
  plazo: "Se guardan los últimos 30 días.",
  regla_de_borrado: "respaldos",
  plazo_dias: 30,
  orden: 9,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("EditorDeFila", () => {
  it("saves the corrected row, with no days as null, and refreshes", async () => {
    guardar.mockResolvedValue({ ok: true })
    render(<EditorDeFila fila={FILA} />)

    fireEvent.change(screen.getByLabelText("País"), { target: { value: "Estados Unidos" } })
    fireEvent.change(screen.getByLabelText("Plazo en días (si la app lo borra sola)"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(guardar).toHaveBeenCalledWith({
      id: FILA.id,
      dato: FILA.dato,
      para_que: FILA.para_que,
      proveedor: "Cloudflare R2",
      pais: "Estados Unidos",
      plazo: FILA.plazo,
      plazo_dias: null,
      orden: 9,
    })
    expect(screen.getByText("Guardado.")).toBeInTheDocument()
  })

  it("says the app deletes this row by itself, and under which rule, without letting it change", () => {
    render(<EditorDeFila fila={FILA} />)
    expect(screen.getByText("respaldos · la app lo borra sola (regla respaldos)")).toBeInTheDocument()
    expect(screen.queryByLabelText(/regla/i)).toBeNull()
  })

  it("confirms the country", async () => {
    confirmar.mockResolvedValue({ ok: true })
    render(<EditorDeFila fila={FILA} />)

    fireEvent.click(screen.getByRole("button", { name: "Confirmar país" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(confirmar).toHaveBeenCalledWith({ id: FILA.id })
  })

  it("offers no confirmation once the country is confirmed", () => {
    render(<EditorDeFila fila={{ ...FILA, pais_confirmado: true }} />)
    expect(screen.getByText("País confirmado.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Confirmar país" })).toBeNull()
  })

  it("adds a new row with its key and empties the form", async () => {
    agregar.mockResolvedValue({ ok: true, id: "nueva" })
    render(<EditorDeFila />)

    for (const [etiqueta, valor] of [
      ["Clave", "comentarios_de_riesgo"],
      ["Dato", "Comentarios con señales de riesgo"],
      ["Para qué", "Avisarte sin guardar su texto."],
      ["Proveedor", "Supabase"],
      ["País", "Por confirmar"],
      ["Plazo en palabras", "90 días"],
      ["Plazo en días (si la app lo borra sola)", "90"],
      ["Orden", "12"],
    ]) {
      fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
    }
    fireEvent.click(screen.getByRole("button", { name: "Agregar fila" }))

    expect(await screen.findByText("Fila agregada.")).toBeInTheDocument()
    expect(agregar).toHaveBeenCalledWith({
      clave: "comentarios_de_riesgo",
      dato: "Comentarios con señales de riesgo",
      para_que: "Avisarte sin guardar su texto.",
      proveedor: "Supabase",
      pais: "Por confirmar",
      plazo: "90 días",
      plazo_dias: 90,
      orden: 12,
    })
    expect(screen.getByLabelText("Clave")).toHaveValue("")
  })

  it("shows why it failed and keeps what was typed", async () => {
    guardar.mockResolvedValue({ ok: false, error: "Esta fila la borra la app sola: necesita su plazo en días." })
    render(<EditorDeFila fila={FILA} />)

    fireEvent.change(screen.getByLabelText("Plazo en días (si la app lo borra sola)"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("necesita su plazo en días")
    expect(screen.getByLabelText("Plazo en días (si la app lo borra sola)")).toHaveValue(null)
    expect(refrescar).not.toHaveBeenCalled()
  })

  it("keeps Confirmar país off until the typed country is saved, and says why", () => {
    render(<EditorDeFila fila={{ ...FILA, pais: "Chile" }} />)

    fireEvent.change(screen.getByLabelText("País"), { target: { value: "Perú" } })
    const boton = screen.getByRole("button", { name: "Confirmar país" })
    expect(boton).toHaveAttribute("aria-disabled", "true")
    expect(boton).toHaveAccessibleDescription(expect.stringContaining("Guarda el país antes de confirmarlo."))
    fireEvent.click(boton)
    expect(confirmar).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("País"), { target: { value: " Chile " } })
    expect(boton).not.toHaveAttribute("aria-disabled")
    expect(screen.queryByText("Guarda el país antes de confirmarlo.")).toBeNull()
  })

  it("tells each row's buttons apart by the row's key", () => {
    render(<EditorDeFila fila={FILA} />)
    const clave = "respaldos · la app lo borra sola (regla respaldos)"
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAccessibleDescription(clave)
    expect(screen.getByRole("button", { name: "Confirmar país" })).toHaveAccessibleDescription(clave)
  })

  it("keeps the status region in place and announces every save", async () => {
    guardar.mockResolvedValue({ ok: true })
    render(<EditorDeFila fila={FILA} />)
    const estado = screen.getByRole("status")
    expect(estado).toHaveTextContent("")

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(estado).toHaveTextContent("Guardado."))
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(estado).toHaveTextContent("")
    await waitFor(() => expect(estado).toHaveTextContent("Guardado."))
    expect(screen.getByRole("status")).toBe(estado)
  })

  it("shows the country is being confirmed and clears an old save notice", async () => {
    guardar.mockResolvedValue({ ok: true })
    let terminar: (valor: { ok: true }) => void = () => {}
    confirmar.mockReturnValue(
      new Promise((resolver) => {
        terminar = resolver
      }),
    )
    render(<EditorDeFila fila={{ ...FILA, pais: "Chile" }} />)

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Guardado."))
    fireEvent.click(screen.getByRole("button", { name: "Confirmar país" }))

    expect(screen.getByRole("button", { name: "Confirmar país" })).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("status")).toHaveTextContent("")
    terminar({ ok: true })
    await waitFor(() => expect(refrescar).toHaveBeenCalledTimes(2))
  })
})
