import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { pedirCodigoAccion, verificarCodigoAccion } from "@/app/ingreso/acciones"
import { FormularioIngreso } from "@/app/ingreso/formulario-ingreso"

vi.mock("@/app/ingreso/acciones", () => ({ pedirCodigoAccion: vi.fn(), verificarCodigoAccion: vi.fn() }))

const pedir = vi.mocked(pedirCodigoAccion)
const verificar = vi.mocked(verificarCodigoAccion)

beforeEach(() => {
  vi.resetAllMocks()
})

function escribirCodigo(codigo: string) {
  const casillas = screen.getAllByRole("textbox")
  fireEvent.paste(casillas[0] as HTMLElement, { clipboardData: { getData: () => codigo } })
}

describe("FormularioIngreso", () => {
  it("offers two buttons, one for Coni and one for WAV, and no email field or address", () => {
    render(<FormularioIngreso />)

    expect(screen.getByRole("button", { name: "Soy Coni" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Soy WAV" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain("@")
  })

  it.each([
    ["Soy Coni", "coni"],
    ["Soy WAV", "wav"],
  ] as const)("%s asks for the code of that person and shows the masked address", async (boton, rol) => {
    pedir.mockResolvedValue({ ok: true, correoEnmascarado: "x•••@estudio.test" })
    render(<FormularioIngreso />)

    fireEvent.click(screen.getByRole("button", { name: boton }))

    expect(await screen.findByRole("heading", { name: "Entra con el código que te mandé" })).toBeInTheDocument()
    expect(pedir).toHaveBeenCalledWith(rol)
    expect(screen.getByText(/x•••@estudio\.test/)).toBeInTheDocument()
  })

  it("verifies the six digits for the person who asked", async () => {
    pedir.mockResolvedValue({ ok: true, correoEnmascarado: "w•••@estudio.test" })
    verificar.mockResolvedValue({ ok: true })
    render(<FormularioIngreso />)
    fireEvent.click(screen.getByRole("button", { name: "Soy WAV" }))
    await screen.findByRole("heading", { name: "Entra con el código que te mandé" })

    escribirCodigo("123456")

    await waitFor(() => expect(verificar).toHaveBeenCalledWith("wav", "123456"))
  })

  it("still verifies a pasted code while another code is being sent", async () => {
    pedir.mockResolvedValueOnce({ ok: true, correoEnmascarado: "w•••@estudio.test" })
    pedir.mockReturnValueOnce(new Promise(() => {}))
    verificar.mockResolvedValue({ ok: true })
    render(<FormularioIngreso />)
    fireEvent.click(screen.getByRole("button", { name: "Soy WAV" }))
    await screen.findByRole("heading", { name: "Entra con el código que te mandé" })
    fireEvent.click(screen.getByRole("button", { name: "Mandar otro código" }))

    escribirCodigo("123456")

    await waitFor(() => expect(verificar).toHaveBeenCalledWith("wav", "123456"))
  })

  it("does not verify the same code twice while the first check is running", async () => {
    pedir.mockResolvedValue({ ok: true, correoEnmascarado: "w•••@estudio.test" })
    verificar.mockReturnValue(new Promise(() => {}))
    render(<FormularioIngreso />)
    fireEvent.click(screen.getByRole("button", { name: "Soy WAV" }))
    await screen.findByRole("heading", { name: "Entra con el código que te mandé" })

    escribirCodigo("123456")
    fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(verificar).toHaveBeenCalledTimes(1))
    expect(verificar).toHaveBeenCalledTimes(1)
  })

  it("says so when the code does not work", async () => {
    pedir.mockResolvedValue({ ok: true, correoEnmascarado: "c•••@estudio.test" })
    verificar.mockResolvedValue({ ok: false, error: "Ese código no sirve o ya venció. Pide otro." })
    render(<FormularioIngreso />)
    fireEvent.click(screen.getByRole("button", { name: "Soy Coni" }))
    await screen.findByRole("heading", { name: "Entra con el código que te mandé" })

    escribirCodigo("000000")

    expect(await screen.findByText("Ese código no sirve o ya venció. Pide otro.")).toBeInTheDocument()
  })

  it("shows the error when the code could not be sent and stays on the first step", async () => {
    pedir.mockResolvedValue({ ok: false, error: "Espera 30 segundos para pedir otro código." })
    render(<FormularioIngreso />)

    fireEvent.click(screen.getByRole("button", { name: "Soy Coni" }))

    expect(await screen.findByText("Espera 30 segundos para pedir otro código.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Soy WAV" })).toBeInTheDocument()
  })
})
