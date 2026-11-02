// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import RootLayout, { viewport } from "@/app/layout"
import { COLOR_DE_FONDO } from "@/lib/diseno/marca"

// next/font only exists inside the Next build; the font is a third-party boundary.
vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "--font-geist-sans" } }))

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8")

describe("brand constants", () => {
  it("repeat the stone of globals.css for the OS, which reads it before any stylesheet", () => {
    expect(css).toContain(`--piedra: ${COLOR_DE_FONDO};`)
  })

  it("tell the phone the app is light only, on the stone colour", () => {
    expect(viewport.colorScheme).toBe("light")
    expect(viewport.themeColor).toBe(COLOR_DE_FONDO)
  })

  it("set the text in Geist, one family, as Conidolly does", () => {
    expect(RootLayout({ children: null }).props.className).toBe("--font-geist-sans")
  })
})
