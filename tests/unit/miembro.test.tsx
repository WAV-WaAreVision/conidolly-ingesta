import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SoloParaMiembros } from "@/components/solo-para-miembros"
import { rolDeMiembro } from "@/lib/sesion/miembro"

vi.mock("@/app/(app)/acciones", () => ({ cerrarSesionAccion: vi.fn() }))

describe("rolDeMiembro", () => {
  it("is coni, wav or nobody", () => {
    expect(rolDeMiembro({ esConi: true, esMantenedor: false })).toBe("coni")
    expect(rolDeMiembro({ esConi: false, esMantenedor: true })).toBe("wav")
    expect(rolDeMiembro({ esConi: false, esMantenedor: false })).toBeNull()
  })
})

describe("SoloParaMiembros", () => {
  it("tells whoever is neither Coni nor WAV that the app is not for them, and lets them leave", () => {
    render(<SoloParaMiembros />)

    expect(screen.getByRole("heading", { name: "Esta app es solo para Coni y WAV." })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument()
  })
})
