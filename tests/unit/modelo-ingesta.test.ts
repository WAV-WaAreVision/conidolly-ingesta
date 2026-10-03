import { describe, expect, it } from "vitest"
import {
  etiquetasDeTexto,
  leerEntrada,
  MAXIMO_DE_IMAGENES,
  TAMANO_MAXIMO_BYTES,
  tipoDeContenido,
} from "@/lib/ingesta/modelo"

const CATEGORIA = "11111111-2222-4333-8444-555555555555"
const base = { categoriaId: CATEGORIA, etiquetas: [], declaracion: true }
const archivo = (nombre: string, tamano = 1000) => ({ nombre, tamano })

function error(entrada: unknown): string {
  const resultado = leerEntrada(entrada)
  if (resultado.ok) throw new Error("Se esperaba un error y la entrada pasó")
  return resultado.error
}

describe("leerEntrada: tipos con un archivo", () => {
  it.each([
    ["documento", "tesis.PDF"],
    ["documento", "notas.docx"],
    ["documento", "notas.txt"],
    ["audio", "charla.mp3"],
    ["audio", "charla.m4a"],
    ["audio", "charla.wav"],
    ["video", "clase.mp4"],
    ["video", "clase.mov"],
  ])("accepts one %s file named %s", (tipo, nombre) => {
    expect(leerEntrada({ ...base, tipo, archivos: [archivo(nombre)] }).ok).toBe(true)
  })

  it.each([
    ["documento", "charla.mp3", "Ese archivo no sirve como documento. Sube un PDF, un Word o un texto."],
    ["audio", "tesis.pdf", "Ese archivo no sirve como audio. Sube un mp3, m4a o wav."],
    ["video", "tesis.pdf", "Ese archivo no sirve como video. Sube un mp4 o mov."],
    ["documento", "virus.exe", "Ese archivo no sirve como documento. Sube un PDF, un Word o un texto."],
  ])("refuses a %s file named %s", (tipo, nombre, mensaje) => {
    expect(error({ ...base, tipo, archivos: [archivo(nombre)] })).toBe(mensaje)
  })

  it.each(["documento", "audio", "video"])("needs exactly one file for %s", (tipo) => {
    const nombre = tipo === "documento" ? "a.pdf" : tipo === "audio" ? "a.mp3" : "a.mp4"
    expect(error({ ...base, tipo, archivos: [] })).toBe("Falta el archivo.")
    expect(error({ ...base, tipo, archivos: [archivo(nombre), archivo(nombre)] })).toBe("Sube un solo archivo.")
  })
})

describe("leerEntrada: imagen", () => {
  it("accepts from one to twenty images in the order given", () => {
    const una = leerEntrada({ ...base, tipo: "imagen", archivos: [archivo("a.jpg")] })
    expect(una.ok).toBe(true)
    const veinte = Array.from({ length: MAXIMO_DE_IMAGENES }, (_, i) => archivo(`${i}.png`))
    expect(leerEntrada({ ...base, tipo: "imagen", archivos: veinte }).ok).toBe(true)
  })

  it("refuses twenty one images and none", () => {
    const veintiuna = Array.from({ length: MAXIMO_DE_IMAGENES + 1 }, (_, i) => archivo(`${i}.png`))
    expect(error({ ...base, tipo: "imagen", archivos: veintiuna })).toBe("Puedes subir hasta 20 imágenes.")
    expect(error({ ...base, tipo: "imagen", archivos: [] })).toBe("Falta el archivo.")
  })

  it.each(["a.jpg", "a.jpeg", "a.png", "a.webp", "a.heic"])("accepts %s", (nombre) => {
    expect(leerEntrada({ ...base, tipo: "imagen", archivos: [archivo(nombre)] }).ok).toBe(true)
  })

  it("refuses a file that is not an image", () => {
    expect(error({ ...base, tipo: "imagen", archivos: [archivo("a.gif")] })).toBe(
      "Ese archivo no sirve como imagen. Sube jpg, png, webp o heic.",
    )
  })
})

describe("leerEntrada: link y post", () => {
  it("needs an http or https address for a link and no files", () => {
    expect(leerEntrada({ ...base, tipo: "link", url: "https://example.com/nota", archivos: [] }).ok).toBe(true)
    expect(error({ ...base, tipo: "link", archivos: [] })).toBe("Falta el link.")
    expect(error({ ...base, tipo: "link", url: "javascript:alert(1)", archivos: [] })).toBe(
      "Ese link no parece una dirección web válida.",
    )
    expect(error({ ...base, tipo: "link", url: "https://example.com", archivos: [archivo("a.pdf")] })).toBe(
      "Un link no lleva archivos.",
    )
  })

  it("needs pasted text for a post and takes an optional video", () => {
    expect(leerEntrada({ ...base, tipo: "post", textoPegado: "Hola", archivos: [] }).ok).toBe(true)
    expect(leerEntrada({ ...base, tipo: "post", textoPegado: "Hola", archivos: [archivo("v.mp4")] }).ok).toBe(true)
    expect(error({ ...base, tipo: "post", textoPegado: "   ", archivos: [] })).toBe("Falta el texto del post.")
    expect(error({ ...base, tipo: "post", textoPegado: "Hola", archivos: [archivo("v.pdf")] })).toBe(
      "Ese archivo no sirve como video. Sube un mp4 o mov.",
    )
  })
})

describe("leerEntrada: el resto de los campos", () => {
  it("trims the title and the author and turns blanks into null", () => {
    const resultado = leerEntrada({
      ...base,
      tipo: "documento",
      titulo: "  Apego adulto ",
      autor: "   ",
      archivos: [archivo("a.pdf")],
    })

    expect(resultado.ok && resultado.datos.titulo).toBe("Apego adulto")
    expect(resultado.ok && resultado.datos.autor).toBeNull()
  })

  it("keeps the reference link only for videos and images, and only if it is a web address", () => {
    const video = leerEntrada({
      ...base,
      tipo: "video",
      referencia: "https://instagram.com/p/x",
      archivos: [archivo("a.mp4")],
    })
    expect(video.ok && video.datos.referencia).toBe("https://instagram.com/p/x")
    const documento = leerEntrada({
      ...base,
      tipo: "documento",
      referencia: "https://x.cl",
      archivos: [archivo("a.pdf")],
    })
    expect(documento.ok && documento.datos.referencia).toBeNull()
    expect(error({ ...base, tipo: "video", referencia: "ftp://x.cl", archivos: [archivo("a.mp4")] })).toBe(
      "Ese link no parece una dirección web válida.",
    )
  })

  it("accepts a file of exactly 2 GB and refuses one byte more or an empty one", () => {
    expect(leerEntrada({ ...base, tipo: "video", archivos: [archivo("a.mp4", TAMANO_MAXIMO_BYTES)] }).ok).toBe(true)
    expect(error({ ...base, tipo: "video", archivos: [archivo("a.mp4", TAMANO_MAXIMO_BYTES + 1)] })).toBe(
      "Ese archivo pesa más de 2 GB.",
    )
    expect(error({ ...base, tipo: "video", archivos: [archivo("a.mp4", 0)] })).toBe("Ese archivo está vacío.")
  })

  it("requires the declaration that there is no patient data", () => {
    expect(error({ ...base, declaracion: false, tipo: "documento", archivos: [archivo("a.pdf")] })).toBe(
      "Marca que el material no contiene datos de pacientes.",
    )
  })

  it("refuses a category that is not an id and a type that does not exist", () => {
    expect(error({ ...base, categoriaId: "x", tipo: "documento", archivos: [archivo("a.pdf")] })).toBe(
      "Elige una categoría.",
    )
    expect(error({ ...base, tipo: "planilla", archivos: [] })).toBe("Elige qué tipo de material es.")
  })

  it("refuses more than twenty tags and tags over forty characters", () => {
    const muchas = Array.from({ length: 21 }, (_, i) => `e${i}`)
    expect(error({ ...base, etiquetas: muchas, tipo: "documento", archivos: [archivo("a.pdf")] })).toBe(
      "Usa hasta 20 etiquetas.",
    )
    expect(error({ ...base, etiquetas: ["x".repeat(41)], tipo: "documento", archivos: [archivo("a.pdf")] })).toBe(
      "Cada etiqueta puede tener hasta 40 letras.",
    )
  })

  it("says it did not understand something that is not even an object", () => {
    expect(error(null)).toBe("No entendí esa solicitud. Vuelve a abrir la pantalla.")
  })
})

describe("etiquetasDeTexto", () => {
  it("splits on commas, trims, drops blanks and repeats", () => {
    expect(etiquetasDeTexto(" pareja, deseo ,, Pareja,  apego ")).toEqual(["pareja", "deseo", "apego"])
  })
})

describe("tipoDeContenido", () => {
  it.each([
    ["pdf", "application/pdf"],
    ["MP3", "audio/mpeg"],
    ["m4a", "audio/mp4"],
    ["wav", "audio/wav"],
    ["mp4", "video/mp4"],
    ["mov", "video/quicktime"],
    ["jpg", "image/jpeg"],
    ["heic", "image/heic"],
    ["txt", "text/plain"],
    ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ])("maps .%s to %s", (extension, esperado) => {
    expect(tipoDeContenido(extension)).toBe(esperado)
  })
})
