"use client"

import type { Core, ElementDefinition, EventObject } from "cytoscape"
import { useEffect, useRef } from "react"
import { TOKEN_DE_SELECCION, TOKEN_DE_TEXTO } from "@/lib/ingesta/grafo"

const MS_DE_PRESION_LARGA = 500

export type NodoConGrafo = HTMLDivElement & { grafo?: Core }

interface Propiedades {
  elementos: ElementDefinition[]
  /** The node held down, waiting for a second tap to become a link. */
  origen: string | null
  alTocarNodo: (id: string) => void
  alTocarArista: (id: string) => void
  alMantenerNodo: (id: string) => void
  alTocarFondo: () => void
}

/** A canvas cannot read Tailwind classes: each token name becomes a colour here, at runtime. */
function color(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function conColores(elementos: ElementDefinition[]): ElementDefinition[] {
  return elementos.map((elemento) => ({
    ...elemento,
    data: { ...elemento.data, color: color(String(elemento.data.token)) },
  }))
}

/** The pan, zoom and tap surface. Cytoscape loads on the client only: it needs the DOM. */
export function GrafoCytoscape(propiedades: Propiedades) {
  const contenedor = useRef<HTMLDivElement>(null)
  const cy = useRef<Core | null>(null)
  const ultimaPresion = useRef({ cuando: 0, id: "" })
  const alDia = useRef(propiedades)
  alDia.current = propiedades

  useEffect(() => {
    let vivo = true
    const nodo = contenedor.current
    if (!nodo) return
    import("cytoscape").then(({ default: cytoscape }) => {
      if (!vivo) return
      const tipografia = getComputedStyle(document.body).fontFamily
      const instancia = cytoscape({
        container: nodo,
        elements: conColores(alDia.current.elementos),
        minZoom: 0.3,
        maxZoom: 3,
        wheelSensitivity: 0.3,
        style: [
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              shape: "ellipse",
              width: "data(size)",
              height: "data(size)",
              label: "data(label)",
              color: color(TOKEN_DE_TEXTO),
              "font-family": tipografia,
              "font-size": 11,
              "text-wrap": "ellipsis",
              "text-max-width": "76px",
              "text-valign": "bottom",
              "text-margin-y": 5,
              "border-width": 0,
            },
          },
          {
            selector: "edge",
            style: {
              "line-color": "data(color)",
              width: "data(width)",
              "curve-style": "bezier",
              opacity: 0.85,
            },
          },
          { selector: 'node[shape = "diamond"]', style: { shape: "diamond" } },
          { selector: "edge[?dashed]", style: { "line-style": "dashed" } },
          {
            selector: ":selected, .origen",
            style: { "border-width": 4, "border-color": color(TOKEN_DE_SELECCION), "overlay-opacity": 0 },
          },
          { selector: "edge:selected", style: { "line-color": color(TOKEN_DE_SELECCION), opacity: 1 } },
        ],
        layout: { name: "cose", animate: false, padding: 24, nodeRepulsion: () => 9000 },
      })
      instancia.on("tap", "node", (evento: EventObject) => {
        // A long press can end with a tap on the same node: it already did its job.
        const id = String(evento.target.id())
        const { cuando, id: sostenido } = ultimaPresion.current
        if (id === sostenido && Date.now() - cuando < MS_DE_PRESION_LARGA) return
        alDia.current.alTocarNodo(id)
      })
      instancia.on("tap", "edge", (evento: EventObject) => alDia.current.alTocarArista(String(evento.target.id())))
      instancia.on("tap", (evento: EventObject) => {
        if (evento.target === instancia) alDia.current.alTocarFondo()
      })
      instancia.on("taphold", "node", (evento: EventObject) => {
        const id = String(evento.target.id())
        ultimaPresion.current = { cuando: Date.now(), id }
        alDia.current.alMantenerNodo(id)
      })
      cy.current = instancia
      // Only the e2e build sets this: the specs read positions from the instance to aim real pointer input.
      if (process.env.NEXT_PUBLIC_EXPONER_GRAFO === "1") (nodo as NodoConGrafo).grafo = instancia
    })
    return () => {
      vivo = false
      cy.current?.destroy()
      cy.current = null
    }
  }, [])

  const { elementos, origen } = propiedades
  useEffect(() => {
    const instancia = cy.current
    if (!instancia) return
    instancia.batch(() => {
      instancia.elements().remove()
      instancia.add(conColores(elementos))
    })
    instancia.layout({ name: "cose", animate: false, padding: 24, nodeRepulsion: () => 9000 }).run()
  }, [elementos])

  useEffect(() => {
    const instancia = cy.current
    if (!instancia) return
    instancia.nodes().removeClass("origen")
    if (origen) instancia.getElementById(origen).addClass("origen")
  }, [origen])

  return (
    <div
      ref={contenedor}
      role="img"
      aria-label="Grafo de vínculos entre materiales. Para usarlo sin verlo, abre Ver como lista."
      data-testid="grafo"
      data-grafo-lienzo=""
      tabIndex={-1}
      className="h-[58dvh] min-h-80 w-full rounded-lg border border-linea bg-superficie"
    />
  )
}
