import { describe, expect, it } from "vitest"
import { almacenEnMemoria, claveMaterial, EXTENSIONES_DE_MATERIAL } from "@/lib/almacen/almacen"
import { FallaDeConfiguracion } from "@/lib/dominio/falla"

const MATERIAL = "11111111-2222-4333-8444-555555555555"
const PDF = new Uint8Array([37, 80, 68, 70])

describe("almacenEnMemoria.urlDeSubida", () => {
  it("gives a URL that lands the bytes at the key with the media type once the upload is simulated", async () => {
    const almacen = almacenEnMemoria()
    const clave = claveMaterial(MATERIAL, "pdf")

    const url = await almacen.urlDeSubida(clave, 600, "application/pdf")
    expect(almacen.claves()).toEqual([])
    almacen.simularSubida(url, PDF)

    expect([...(almacen.obtener(clave)?.datos ?? [])]).toEqual([...PDF])
    expect(almacen.obtener(clave)?.tipo).toBe("application/pdf")
  })

  it("refuses a key outside materiales/ and an expiry over one hour", async () => {
    const almacen = almacenEnMemoria()
    await expect(almacen.urlDeSubida("voces/a.mp3", 600, "audio/mpeg")).rejects.toThrow(FallaDeConfiguracion)
    await expect(almacen.urlDeSubida(claveMaterial(MATERIAL, "pdf"), 3601, "application/pdf")).rejects.toThrow()
    await expect(almacen.urlDeSubida(claveMaterial(MATERIAL, "pdf"), 0, "application/pdf")).rejects.toThrow()
  })

  it.each([...EXTENSIONES_DE_MATERIAL])("accepts the key claveMaterial gives for .%s", async (extension) => {
    await expect(
      almacenEnMemoria().urlDeSubida(claveMaterial(MATERIAL, extension), 600, "application/octet-stream"),
    ).resolves.toContain("materiales/")
  })

  it.each(Array.from({ length: 20 }, (_, i) => i + 1))(
    "accepts the key claveMaterial gives for image %i",
    async (orden) => {
      await expect(
        almacenEnMemoria().urlDeSubida(claveMaterial(MATERIAL, "jpg", orden), 600, "image/jpeg"),
      ).resolves.toContain("materiales/")
    },
  )

  it.each([
    "materiales/../x",
    "materiales/anything",
    `materiales/${MATERIAL}/otro.pdf`,
    `materiales/${MATERIAL}/original.exe`,
    `materiales/${MATERIAL}/original-21.jpg`,
    `materiales/${MATERIAL}/original-1.jpg`,
    `materiales/${MATERIAL}/original.pdf/x`,
  ])("refuses the key %s, which claveMaterial never produces", async (clave) => {
    await expect(almacenEnMemoria().urlDeSubida(clave, 600, "application/pdf")).rejects.toThrow(FallaDeConfiguracion)
  })

  it("refuses to simulate an upload to a URL it did not give", () => {
    expect(() => almacenEnMemoria().simularSubida("https://otro.test/x", PDF)).toThrow()
  })
})

describe("almacenEnMemoria.tamano", () => {
  it("is the number of bytes of the object, and null when it is not there", async () => {
    const almacen = almacenEnMemoria()
    const clave = claveMaterial(MATERIAL, "pdf")
    expect(await almacen.tamano(clave)).toBeNull()

    almacen.simularSubida(await almacen.urlDeSubida(clave, 600, "application/pdf"), PDF)

    expect(await almacen.tamano(clave)).toBe(PDF.byteLength)
  })

  it("can pretend an object is huge without holding its bytes", async () => {
    const almacen = almacenEnMemoria()
    const clave = claveMaterial(MATERIAL, "mp4")
    almacen.simularSubida(await almacen.urlDeSubida(clave, 600, "video/mp4"), { bytes: 3 * 1024 ** 3 })

    expect(await almacen.tamano(clave)).toBe(3 * 1024 ** 3)
  })
})

describe("claveMaterial", () => {
  it("is materiales/<uuid>/original.<ext> with the extension lowercased", () => {
    expect(claveMaterial(MATERIAL, "PDF")).toBe(`materiales/${MATERIAL}/original.pdf`)
  })

  it("numbers the images of a multi-image material with two digits", () => {
    expect(claveMaterial(MATERIAL, "jpg", 3)).toBe(`materiales/${MATERIAL}/original-03.jpg`)
    expect(claveMaterial(MATERIAL, "heic", 20)).toBe(`materiales/${MATERIAL}/original-20.heic`)
  })

  it.each([0, 21, 1.5, -1])("refuses an order of %s", (orden) => {
    expect(() => claveMaterial(MATERIAL, "jpg", orden)).toThrow(FallaDeConfiguracion)
  })

  it.each(["exe", "", "pdf/../x", "tar.gz"])("refuses the extension %j", (extension) => {
    expect(() => claveMaterial(MATERIAL, extension)).toThrow(FallaDeConfiguracion)
  })

  it("refuses an id that is not a UUID", () => {
    expect(() => claveMaterial("../x", "pdf")).toThrow(FallaDeConfiguracion)
  })
})

const TEXTO = `materiales/${MATERIAL}/texto.txt`
const TEXTO_ORIGINAL = `materiales/${MATERIAL}/texto-original.txt`

describe("almacenEnMemoria.urlFirmada", () => {
  it("signs a download of the translated or the original text, with its file name and a short expiry", async () => {
    const almacen = almacenEnMemoria()
    almacen.poner(TEXTO, new Uint8Array([104]), "text/plain")

    expect(await almacen.urlFirmada(TEXTO, 300, { descargarComo: "texto.txt" })).toBe(
      `https://almacen.test/${TEXTO}?expira=300&descarga=texto.txt`,
    )
  })

  it("is null when the object is not there", async () => {
    expect(await almacenEnMemoria().urlFirmada(TEXTO_ORIGINAL, 300)).toBeNull()
  })

  it.each([
    `materiales/${MATERIAL}/original.pdf`,
    `materiales/${MATERIAL}/ficha.json`,
    `materiales/${MATERIAL}/texto.txt/../original.pdf`,
    "materiales/no-uuid/texto.txt",
    `otra/${MATERIAL}/texto.txt`,
  ])("refuses to sign %s", async (clave) => {
    await expect(almacenEnMemoria().urlFirmada(clave, 300)).rejects.toThrow(FallaDeConfiguracion)
  })

  it.each([0, 1.5, 3601])("refuses an expiry of %s", async (segundos) => {
    await expect(almacenEnMemoria().urlFirmada(TEXTO, segundos)).rejects.toThrow(FallaDeConfiguracion)
  })

  it.each(["../x.txt", 'a"b.txt', "con espacio.txt", ""])("refuses the download name %j", async (nombre) => {
    const almacen = almacenEnMemoria()
    almacen.poner(TEXTO, new Uint8Array([1]), "text/plain")
    await expect(almacen.urlFirmada(TEXTO, 300, { descargarComo: nombre })).rejects.toThrow(FallaDeConfiguracion)
  })
})

describe("almacenEnMemoria.borrarCarpeta", () => {
  it("deletes every object under the material's folder and nothing else", async () => {
    const almacen = almacenEnMemoria()
    const otro = "99999999-2222-4333-8444-555555555555"
    almacen.poner(TEXTO, new Uint8Array([1]), "text/plain")
    almacen.poner(`materiales/${MATERIAL}/original.pdf`, new Uint8Array([1]), "application/pdf")
    almacen.poner(`materiales/${otro}/texto.txt`, new Uint8Array([1]), "text/plain")
    almacen.poner(`materiales/${MATERIAL}x/texto.txt`, new Uint8Array([1]), "text/plain")

    expect(await almacen.borrarCarpeta(MATERIAL)).toBe(2)

    expect(almacen.claves().sort()).toEqual(
      [`materiales/${MATERIAL}x/texto.txt`, `materiales/${otro}/texto.txt`].sort(),
    )
  })

  it.each(["", "../materiales", "materiales", "11111111-2222-4333-8444-5555555555zz"])(
    "refuses %j as a material id",
    async (id) => {
      await expect(almacenEnMemoria().borrarCarpeta(id)).rejects.toThrow(FallaDeConfiguracion)
    },
  )
})
