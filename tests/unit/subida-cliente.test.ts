import { describe, expect, it, vi } from "vitest"
import { subirArchivos } from "@/lib/ingesta/subida-cliente"

const archivo = (nombre: string, tipo: string) => new File(["contenido"], nombre, { type: tipo })

describe("subirArchivos", () => {
  it("puts each file straight to its URL with the content type that was signed, in order", async () => {
    const enviar = vi.fn(async () => new Response(null, { status: 200 }))
    const avances: [number, number][] = []

    await subirArchivos({
      subidas: [
        { orden: 1, url: "https://r2.test/a", tipoContenido: "image/jpeg" },
        { orden: 2, url: "https://r2.test/b", tipoContenido: "image/png" },
      ],
      archivos: [archivo("a.jpg", "image/jpeg"), archivo("b.png", "")],
      enviar,
      alAvanzar: (hechos, total) => avances.push([hechos, total]),
    })

    expect(enviar).toHaveBeenNthCalledWith(1, "https://r2.test/a", {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: expect.any(File),
    })
    expect(enviar).toHaveBeenNthCalledWith(
      2,
      "https://r2.test/b",
      expect.objectContaining({ headers: { "Content-Type": "image/png" } }),
    )
    expect(avances).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ])
  })

  it("says which file failed when the store answers with an error, and stops there", async () => {
    const enviar = vi.fn(async () => new Response(null, { status: 403 }))

    await expect(
      subirArchivos({
        subidas: [{ orden: 1, url: "https://r2.test/a", tipoContenido: "application/pdf" }],
        archivos: [archivo("tesis.pdf", "application/pdf")],
        enviar,
      }),
    ).rejects.toThrow("No pude subir tesis.pdf. Revisa tu conexión e inténtalo de nuevo.")
  })

  it("says the same when the network drops", async () => {
    const enviar = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })

    await expect(
      subirArchivos({
        subidas: [{ orden: 1, url: "https://r2.test/a", tipoContenido: "application/pdf" }],
        archivos: [archivo("tesis.pdf", "application/pdf")],
        enviar,
      }),
    ).rejects.toThrow("No pude subir tesis.pdf. Revisa tu conexión e inténtalo de nuevo.")
  })
})
