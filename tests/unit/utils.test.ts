import { describe, expect, it } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("keeps a size of the scale next to a colour (stock tailwind-merge reads text-meta as a colour)", () => {
    expect(cn("text-meta", "text-apagado")).toBe("text-meta text-apagado")
    expect(cn("text-pantalla", "text-tinta")).toBe("text-pantalla text-tinta")
  })

  it("lets the later relief, radius or target win, like any other utility", () => {
    expect(cn("shadow-relieve", "shadow-hundido")).toBe("shadow-hundido")
    expect(cn("rounded-panel", "rounded-control")).toBe("rounded-control")
    expect(cn("min-h-boton", "min-h-objetivo")).toBe("min-h-objetivo")
  })
})
