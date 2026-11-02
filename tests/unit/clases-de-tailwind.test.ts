// @vitest-environment node
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..")

// The Tailwind that `next build` runs: @tailwindcss/postcss brings its compiler and its class scanner, so they are
// loaded from there instead of pinning a version of packages the repo does not list.
const desdeTailwind = createRequire(createRequire(join(RAIZ, "package.json")).resolve("@tailwindcss/postcss"))

interface Compilador {
  build(candidatos: string[]): string
}
interface ModuloNode {
  compile(css: string, opciones: { base: string; onDependency: (ruta: string) => void }): Promise<Compilador>
}
interface ModuloOxide {
  Scanner: new (opciones: { sources: { base: string; pattern: string; negated: boolean }[] }) => { scan(): string[] }
}

function cargar<T>(nombre: string, clave: string): T {
  const modulo: unknown = desdeTailwind(nombre)
  if (typeof modulo !== "object" || modulo === null || !(clave in modulo)) {
    throw new Error(`${nombre} ya no expone ${clave}: revisa este test contra la versión de Tailwind instalada.`)
  }
  return modulo as T
}

const { compile } = cargar<ModuloNode>("@tailwindcss/node", "compile")
const { Scanner } = cargar<ModuloOxide>("@tailwindcss/oxide", "Scanner")

async function compilar(): Promise<Compilador> {
  return compile(readFileSync(join(RAIZ, "app", "globals.css"), "utf-8"), {
    base: join(RAIZ, "app"),
    onDependency: () => {},
  })
}

/**
 * The candidates that add no CSS. The compiler keeps every candidate it has seen and answers the whole sheet, so a
 * candidate that leaves the sheet as it was emits nothing.
 */
function sinCss(compilador: Compilador, candidatos: string[]): string[] {
  let hoja = compilador.build([])
  return candidatos.filter((candidato) => {
    const nueva = compilador.build([candidato])
    const muerto = nueva === hoja
    hoja = nueva
    return muerto
  })
}

// The utilities this repo writes. The scanner also returns every word of the code, so only what starts like one of
// these (after its variants) is held to emitting CSS.
const PARECE_UTILIDAD =
  /^-?(?:bg|text|border|rounded|shadow|ring|outline|min-h|max-h|min-w|max-w|h|w|size|p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|grid-cols|grid-rows|col-span|row-span|font|ease|duration|delay|decoration|underline-offset|accent|fill|stroke|divide|placeholder|leading|tracking|inset|top|left|right|bottom|z|opacity|translate|scale|items|justify|content|self|place|flex|basis|grow|shrink|order|overflow|whitespace|aspect|object|transition|cursor|line-clamp|scroll|snap|space-[xy]|list|break)-/

// Words of the code that look like a utility and are not one: HTTP header names and Node's built-in modules.
const NO_SON_CLASES = new Set(["content-length", "content-type"])
const ES_MODULO_DE_NODE = /^node:/

/** The variants and the utility of a candidate; a colon inside brackets (has-[:checked]) does not separate them. */
function partes(candidato: string): { variantes: string[]; utilidad: string } {
  const segmentos = candidato.replace(/^!|!$/g, "").split(/:(?![^[]*\])/)
  return { variantes: segmentos.slice(0, -1), utilidad: segmentos.at(-1) ?? "" }
}

function pareceUtilidad(candidato: string): boolean {
  if (NO_SON_CLASES.has(candidato) || ES_MODULO_DE_NODE.test(candidato)) return false
  const { variantes, utilidad } = partes(candidato)
  return variantes.length > 0 || PARECE_UTILIDAD.test(utilidad)
}

describe("the classes of app, components and lib", () => {
  let compilador: Compilador

  beforeAll(async () => {
    compilador = await compilar()
  })

  it("tells a class that emits CSS from one that does not (the check itself)", () => {
    // Tailwind's default palette and scale are closed (tema-cerrado.css), and a misspelt variant emits nothing.
    const muertos = ["bg-white", "text-sm", "rounded-lg", "has-chekced:bg-piedra", "bg-piedrra"]
    const vivos = ["bg-piedra", "text-meta", "shadow-relieve", "has-[:focus-visible]:outline-tinta", "ease-salida"]

    expect(sinCss(compilador, [...muertos, ...vivos])).toEqual(muertos)
    expect([...muertos, ...vivos].every(pareceUtilidad)).toBe(true)
  })

  it("every candidate that looks like a utility emits CSS with Conidolly's tokens", async () => {
    const escaner = new Scanner({
      sources: ["app", "components", "lib"].map((carpeta) => ({
        base: join(RAIZ, carpeta),
        pattern: "**/*",
        negated: false,
      })),
    })
    const candidatos = escaner.scan()
    // A scan that finds nothing would pass trivially.
    expect(candidatos.length).toBeGreaterThan(500)

    expect(
      sinCss(await compilar(), candidatos)
        .filter(pareceUtilidad)
        .sort(),
    ).toEqual([])
  })
})
