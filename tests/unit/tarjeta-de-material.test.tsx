import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { reintentarMaterialAccion } from "@/app/(app)/materiales/acciones"
import { TarjetaDeMaterial } from "@/app/(app)/tarjeta-de-material"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/materiales/acciones", () => ({ reintentarMaterialAccion: vi.fn() }))

const reintentar = vi.mocked(reintentarMaterialAccion)
const ID = "11111111-2222-4333-8444-555555555555"
const material = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  titulo: "Apego adulto",
  autor: "Esther Perel",
  tipo: "documento",
  estado: "listo",
  motivo_fallo: null,
  categoria: "General",
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TarjetaDeMaterial", () => {
  it("links a ready material to its card and shows the Listo chip", () => {
    render(<TarjetaDeMaterial material={material()} />)

    expect(screen.getByRole("link", { name: /Apego adulto/ })).toHaveAttribute("href", `/materiales/${ID}`)
    expect(screen.getByText("Listo")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
  })

  it("shows Procesando without a retry while it is really processing", () => {
    render(<TarjetaDeMaterial material={material({ estado: "procesando" })} />)

    expect(screen.getByText("Procesando")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
  })

  it("shows the reason and a retry for a material that could not be processed", () => {
    render(<TarjetaDeMaterial material={material({ estado: "fallido", motivo_fallo: "El PDF no tiene texto." })} />)

    expect(screen.getByText("No se pudo procesar")).toBeInTheDocument()
    expect(screen.getByText("El PDF no tiene texto.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })

  it("shows the reason and a retry for a material the monthly cap stopped", () => {
    render(
      <TarjetaDeMaterial material={material({ estado: "procesando", motivo_fallo: "Llegaste al tope de gasto." })} />,
    )

    expect(screen.getByText("Procesando")).toBeInTheDocument()
    expect(screen.getByText("Llegaste al tope de gasto.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })

  it("retries through the action and refreshes the list", async () => {
    reintentar.mockResolvedValue({ ok: true })
    render(<TarjetaDeMaterial material={material({ estado: "fallido", motivo_fallo: "x" })} />)

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))

    await waitFor(() => expect(refrescar).toHaveBeenCalled())
    expect(reintentar).toHaveBeenCalledWith({ materialId: ID })
  })

  it("says why a retry did not start and does not refresh", async () => {
    reintentar.mockResolvedValue({ ok: false, error: "Ese material ya no se puede reintentar." })
    render(<TarjetaDeMaterial material={material({ estado: "fallido", motivo_fallo: "x" })} />)

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese material ya no se puede reintentar.")
    expect(refrescar).not.toHaveBeenCalled()
  })
})
