import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { confirmarCostoAccion, reintentarMaterialAccion } from "@/app/(app)/materiales/acciones"
import { TarjetaDeMaterial } from "@/app/(app)/tarjeta-de-material"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar, push: vi.fn() }) }))
vi.mock("@/app/(app)/materiales/acciones", () => ({ reintentarMaterialAccion: vi.fn(), confirmarCostoAccion: vi.fn() }))

const reintentar = vi.mocked(reintentarMaterialAccion)
const confirmar = vi.mocked(confirmarCostoAccion)
const ID = "11111111-2222-4333-8444-555555555555"
const material = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  titulo: "Apego adulto",
  autor: "Esther Perel",
  tipo: "documento",
  estado: "listo",
  motivo_fallo: null,
  costo_estimado_usd: null,
  costo_confirmado_en: null,
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

  describe("a long material waiting for its cost to be confirmed", () => {
    const esperando = () =>
      material({
        estado: "procesando",
        motivo_fallo: "Este material es largo: procesarlo cuesta cerca de US$ 0,80. Confírmalo para seguir.",
        costo_estimado_usd: 0.8,
      })

    it("shows the reason and a button with the price instead of a retry", () => {
      render(<TarjetaDeMaterial material={esperando()} />)

      expect(screen.getByText(/procesarlo cuesta cerca de US\$ 0,80/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Procesar por ~US$ 0,80" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
    })

    it("confirms through the action and refreshes the list", async () => {
      confirmar.mockResolvedValue({ ok: true })
      render(<TarjetaDeMaterial material={esperando()} />)

      fireEvent.click(screen.getByRole("button", { name: "Procesar por ~US$ 0,80" }))

      await waitFor(() => expect(refrescar).toHaveBeenCalled())
      expect(confirmar).toHaveBeenCalledWith({ materialId: ID })
    })

    it("says why the confirmation did not go through and does not refresh", async () => {
      confirmar.mockResolvedValue({ ok: false, error: "Ese material ya no espera confirmación." })
      render(<TarjetaDeMaterial material={esperando()} />)

      fireEvent.click(screen.getByRole("button", { name: "Procesar por ~US$ 0,80" }))

      expect(await screen.findByRole("alert")).toHaveTextContent("Ese material ya no espera confirmación.")
      expect(refrescar).not.toHaveBeenCalled()
    })

    it("goes back to a plain retry when the dispatch after confirming failed", () => {
      render(
        <TarjetaDeMaterial
          material={{
            ...esperando(),
            motivo_fallo: "No pude iniciar el procesamiento. Reintenta.",
            costo_confirmado_en: "2026-10-03T12:00:00Z",
          }}
        />,
      )

      expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Procesar por/ })).toBeNull()
    })
  })
})
