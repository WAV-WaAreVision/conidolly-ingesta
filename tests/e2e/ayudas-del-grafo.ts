import type { Page } from "@playwright/test"

export interface Punto {
  x: number
  y: number
}
type Cy = {
  getElementById: (id: string) => {
    renderedPosition: () => Punto
    renderedMidpoint: () => Punto
    data: (campo: string) => unknown
    hasClass: (nombre: string) => boolean
    nonempty: () => boolean
  }
  nodes: () => { length: number }
}
type Contenedor = HTMLElement & { grafo?: Cy }

/** Where an element of the graph is on the page, read from the Cytoscape instance the e2e build exposes. */
export async function lugarDe(page: Page, tipo: "nodo" | "arista", id: string): Promise<Punto> {
  const lienzo = page.getByTestId("grafo")
  await lienzo.scrollIntoViewIfNeeded()
  const handle = await lienzo.elementHandle()
  if (!handle) throw new Error("No encontré el lienzo del grafo.")
  await page.waitForFunction(
    ([el, elemento]) => (el as Contenedor).grafo?.getElementById(String(elemento)).nonempty() === true,
    [handle, id] as const,
  )
  return handle.evaluate(
    (el, [tipoDeElemento, elemento]) => {
      const cy = (el as Contenedor).grafo
      if (!cy) throw new Error("El grafo no está expuesto.")
      const caja = el.getBoundingClientRect()
      const e = cy.getElementById(String(elemento))
      const p = tipoDeElemento === "nodo" ? e.renderedPosition() : e.renderedMidpoint()
      return { x: caja.left + p.x, y: caja.top + p.y }
    },
    [tipo, id] as const,
  )
}

export async function dato(page: Page, id: string, campo: string): Promise<unknown> {
  const handle = await page.getByTestId("grafo").elementHandle()
  if (!handle) throw new Error("No encontré el lienzo del grafo.")
  return handle.evaluate(
    (el, [elemento, c]) => (el as Contenedor).grafo?.getElementById(String(elemento)).data(String(c)),
    [id, campo] as const,
  )
}

export async function tieneClase(page: Page, id: string, clase: string): Promise<boolean> {
  const handle = await page.getByTestId("grafo").elementHandle()
  if (!handle) throw new Error("No encontré el lienzo del grafo.")
  return handle.evaluate(
    (el, [elemento, c]) => (el as Contenedor).grafo?.getElementById(String(elemento)).hasClass(String(c)) === true,
    [id, clase] as const,
  )
}
