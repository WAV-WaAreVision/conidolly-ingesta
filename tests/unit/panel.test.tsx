import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Panel } from "@/app/(app)/grafo/panel"

function Prueba() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>
        Abrir
      </button>
      <div data-grafo-lienzo="" tabIndex={-1}>
        lienzo
      </div>
      {abierto ? (
        <Panel titulo="Mi hoja" alCerrar={() => setAbierto(false)}>
          <button type="button">Dentro</button>
        </Panel>
      ) : null}
    </>
  )
}

describe("Panel", () => {
  it("is modal and moves focus to its heading when it opens", () => {
    render(<Prueba />)
    screen.getByRole("button", { name: "Abrir" }).focus()
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }))

    expect(screen.getByRole("dialog", { name: "Mi hoja" })).toHaveAttribute("aria-modal", "true")
    expect(screen.getByRole("heading", { name: "Mi hoja" })).toHaveFocus()
  })

  it("closes with Escape and gives the focus back to what opened it", () => {
    render(<Prueba />)
    const abrir = screen.getByRole("button", { name: "Abrir" })
    abrir.focus()
    fireEvent.click(abrir)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(abrir).toHaveFocus()
  })

  it("gives the focus to the graph when what opened it is gone", () => {
    render(<Prueba />)
    document.body.focus()
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }))
    ;(document.activeElement as HTMLElement).blur()

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }))

    expect(screen.getByText("lienzo")).toHaveFocus()
  })
})
