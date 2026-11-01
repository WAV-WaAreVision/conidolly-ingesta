import { describe, expect, it } from "vitest"
import { falloDeEscritura, SOLO_WAV } from "@/lib/ingesta/datos-personales"

describe("falloDeEscritura", () => {
  it("answers SOLO_WAV when row level security or a column grant refuses the write", () => {
    expect(
      falloDeEscritura("agregarFila", { code: "42501", message: "new row violates row-level security policy" }),
    ).toEqual({ ok: false, error: SOLO_WAV })
  })

  it("names a duplicated key", () => {
    expect(falloDeEscritura("agregarFila", { code: "23505", message: "duplicate key" })).toEqual({
      ok: false,
      error: "Ya hay una fila con esa clave.",
    })
  })
})
