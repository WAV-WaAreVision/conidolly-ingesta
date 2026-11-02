import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NavegacionPrincipal } from "@/components/navegacion-principal"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("NavegacionPrincipal", () => {
  it("links Materiales, Autores and Temas and marks the current one", () => {
    render(<NavegacionPrincipal actual="autores" rol="coni" />)

    expect(screen.getByRole("link", { name: "Materiales" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Autores" })).toHaveAttribute("href", "/autores")
    expect(screen.getByRole("link", { name: "Temas" })).toHaveAttribute("href", "/temas")
    expect(screen.getByRole("link", { name: "Autores" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Temas" })).not.toHaveAttribute("aria-current")
  })

  it("shows Datos to WAV only", () => {
    const { unmount } = render(<NavegacionPrincipal actual="materiales" rol="coni" />)
    expect(screen.queryByRole("link", { name: "Datos" })).toBeNull()
    unmount()

    render(<NavegacionPrincipal actual="datos" rol="wav" />)
    expect(screen.getByRole("link", { name: "Datos" })).toHaveAttribute("href", "/datos-personales")
    expect(screen.getByRole("link", { name: "Datos" })).toHaveAttribute("aria-current", "page")
  })

  it("takes Coni back to Conidolly, the app she came from, at its origin", () => {
    vi.stubEnv("CONIDOLLY_URL", "https://conidolly.example/inicio?desde=ingesta")
    render(<NavegacionPrincipal actual="materiales" rol="coni" />)

    expect(screen.getByRole("link", { name: "Volver a Conidolly" })).toHaveAttribute(
      "href",
      "https://conidolly.example",
    )
  })

  it("hides the link when CONIDOLLY_URL is not a full URL", () => {
    vi.stubEnv("CONIDOLLY_URL", "conidolly.vercel.app")
    render(<NavegacionPrincipal actual="materiales" rol="coni" />)

    expect(screen.queryByRole("link", { name: "Volver a Conidolly" })).toBeNull()
  })

  it("never offers Conidolly to WAV, which does not enter it", () => {
    vi.stubEnv("CONIDOLLY_URL", "https://conidolly.example")
    render(<NavegacionPrincipal actual="materiales" rol="wav" />)

    expect(screen.queryByRole("link", { name: "Volver a Conidolly" })).toBeNull()
  })

  it("hides the link while CONIDOLLY_URL is not set", () => {
    vi.stubEnv("CONIDOLLY_URL", "")
    render(<NavegacionPrincipal actual="materiales" rol="coni" />)

    expect(screen.queryByRole("link", { name: "Volver a Conidolly" })).toBeNull()
  })

  it("is Conidolly's segmented control: a sunken track and the current section raised", () => {
    render(<NavegacionPrincipal actual="temas" rol="coni" />)

    expect(screen.getByRole("navigation", { name: "Secciones" })).toHaveClass("bg-piedra-honda", "shadow-hundido")
    expect(screen.getByRole("link", { name: "Temas" })).toHaveClass(
      "bg-piedra",
      "shadow-relieve",
      "font-semibold",
      "min-h-objetivo",
      "rounded-control",
    )
    expect(screen.getByRole("link", { name: "Autores" })).toHaveClass("text-apagado")
    expect(screen.getByRole("link", { name: "Autores" }).className).not.toMatch(/shadow-relieve/)
  })
})
