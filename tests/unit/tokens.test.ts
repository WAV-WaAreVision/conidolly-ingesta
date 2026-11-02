// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..")
const CSS = readFileSync(join(RAIZ, "app", "globals.css"), "utf-8")

function token(nombre: string): string {
  const valor = new RegExp(`--${nombre}:\\s*(#[0-9a-f]{6});`).exec(CSS)?.[1]
  if (!valor) throw new Error(`No encontré --${nombre} con un color hex en app/globals.css`)
  return valor
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((inicio) => {
    const canal = Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return ((clara ?? 0) + 0.05) / ((oscura ?? 0) + 0.05)
}

/** Every class name of the old raspberry palette and serif scale (rename map, plan P6). */
const NOMBRES_VIEJOS =
  /(?<![\w-])(?:[\w-]+:)*(?:(?:bg|text|border(?:-[lrtbxy])?|outline|accent|fill|stroke|ring|decoration|divide)-(?:fondo|superficie|hundido|linea|acento(?:-profundo|-suave|-claro)?|sobre-acento|(?:ok|aviso|error)-(?:tinta|fondo))|text-(?:display|title|label|body|nav|script)|rounded-(?:sm|md|lg|xl)|font-serif|ease-fuerte|shadow-flotante)(?![\w-])/

/** A hex colour of 3, 4, 6 or 8 digits, or a colour function. */
const COLOR_LITERAL = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b|\b(?:rgba?|hsla?|oklch)\(/i

function archivosDeLaApp(extensiones = /\.tsx?$/): string[] {
  return ["app", "components", "lib"].flatMap((carpeta) =>
    readdirSync(join(RAIZ, carpeta), { recursive: true, encoding: "utf-8" })
      .filter((ruta) => extensiones.test(ruta) && !ruta.endsWith("database.types.ts"))
      .map((ruta) => join(carpeta, ruta)),
  )
}

describe("Conidolly's tokens in Ingesta", () => {
  it("carry Conidolly's stone, ink, signature and light", () => {
    expect(token("piedra")).toBe("#ebebea")
    expect(token("piedra-alta")).toBe("#f4f4f3")
    expect(token("piedra-honda")).toBe("#dcdcdb")
    expect(token("tinta")).toBe("#262626")
    expect(token("firma")).toBe("#a8285a")
    expect(token("luz")).toBe("#fbfbfa")
  })

  it.each(["ok", "aviso", "error", "apagado", "tinta"])(
    "keep %s readable (AA) on piedra and on piedra-honda",
    (nombre) => {
      expect(contraste(token(nombre), token("piedra"))).toBeGreaterThanOrEqual(4.5)
      expect(contraste(token(nombre), token("piedra-honda"))).toBeGreaterThanOrEqual(4.5)
    },
  )

  it("name Conidolly's globals.css as their source", () => {
    expect(CSS).toContain("estudio-coni app/globals.css")
    expect(CSS).not.toContain("docs/DESIGN.md")
  })

  it("leave no class with an old token name in app, components or lib", () => {
    const conNombresViejos = archivosDeLaApp().filter((ruta) =>
      NOMBRES_VIEJOS.test(readFileSync(join(RAIZ, ruta), "utf-8")),
    )
    expect(conNombresViejos).toEqual([])
  })

  it("keep literal colours in globals.css and the OS colour of lib/diseno/marca.ts only", () => {
    const permitidos = new Set([join("app", "globals.css"), join("lib", "diseno", "marca.ts")])
    const conColor = archivosDeLaApp(/\.(?:tsx?|css)$/).filter(
      (ruta) => !permitidos.has(ruta) && COLOR_LITERAL.test(readFileSync(join(RAIZ, ruta), "utf-8")),
    )
    expect(conColor).toEqual([])
  })

  it.each(["#fff", "#ffff", "#ebebea", "#ebebeaff", "rgb(0 0 0)", "rgba(0,0,0,.5)", "hsl(0 0% 0%)", "oklch(0.5 0 0)"])(
    "recognise %s as a literal colour",
    (literal) => {
      expect(COLOR_LITERAL.test(`className="[color:${literal}]"`)).toBe(true)
    },
  )
})
