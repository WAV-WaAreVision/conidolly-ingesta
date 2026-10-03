import { describe, expect, it } from "vitest"
import {
  AYUDA_DE_ROL,
  ETIQUETA_DE_ROL,
  leerEntrada,
  MAXIMO_DE_IMAGENES,
  ROLES,
  TAMANO_MAXIMO_BYTES,
  tipoDeContenido,
} from "@/lib/ingesta/modelo"

const AUTOR = "11111111-2222-4333-8444-555555555555"
const base = { autorId: AUTOR, rol: "referente", declaracion: true }
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
  it("trims the title and turns a blank one into null", () => {
    const con = leerEntrada({ ...base, tipo: "documento", titulo: "  Apego adulto ", archivos: [archivo("a.pdf")] })
    const sin = leerEntrada({ ...base, tipo: "documento", titulo: "   ", archivos: [archivo("a.pdf")] })

    expect(con.ok && con.datos.titulo).toBe("Apego adulto")
    expect(sin.ok && sin.datos.titulo).toBeNull()
  })

  it("keeps the author and the role it was given", () => {
    const resultado = leerEntrada({ ...base, rol: "voz_propia", tipo: "documento", archivos: [archivo("a.pdf")] })

    expect(resultado.ok && resultado.datos.autorId).toBe(AUTOR)
    expect(resultado.ok && resultado.datos.rol).toBe("voz_propia")
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

  it("asks for an author, and refuses one that is not an id", () => {
    expect(error({ ...base, autorId: "", tipo: "documento", archivos: [archivo("a.pdf")] })).toBe("Elige el autor.")
    expect(error({ ...base, autorId: "Esther", tipo: "documento", archivos: [archivo("a.pdf")] })).toBe(
      "Elige el autor.",
    )
  })

  it.each(ROLES)("accepts the role %s", (rol) => {
    expect(leerEntrada({ ...base, rol, tipo: "documento", archivos: [archivo("a.pdf")] }).ok).toBe(true)
  })

  it("asks for a role, and refuses one that does not exist", () => {
    expect(error({ ...base, rol: "", tipo: "documento", archivos: [archivo("a.pdf")] })).toBe(
      "Elige qué papel cumple este material.",
    )
    expect(error({ ...base, rol: "jefa", tipo: "documento", archivos: [archivo("a.pdf")] })).toBe(
      "Elige qué papel cumple este material.",
    )
  })

  it("no longer reads a category or tags: they are not part of the form", () => {
    const resultado = leerEntrada({
      ...base,
      categoriaId: "x",
      etiquetas: ["a"],
      tipo: "documento",
      archivos: [archivo("a.pdf")],
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.ok && Object.keys(resultado.datos)).not.toContain("categoriaId")
    expect(resultado.ok && Object.keys(resultado.datos)).not.toContain("etiquetas")
  })

  it("refuses a type that does not exist", () => {
    expect(error({ ...base, tipo: "planilla", archivos: [] })).toBe("Elige qué tipo de material es.")
  })

  it("says it did not understand something that is not even an object", () => {
    expect(error(null)).toBe("No entendí esa solicitud. Vuelve a abrir la pantalla.")
  })
})

describe("los roles", () => {
  it("says each of the four in the words of the form, with one line of help", () => {
    expect(ROLES.map((rol) => ETIQUETA_DE_ROL[rol])).toEqual([
      "Lo dijo Coni",
      "Referente",
      "Estudio o libro",
      "Estrategia interna",
    ])
    for (const rol of ROLES) expect(AYUDA_DE_ROL[rol].length).toBeGreaterThan(10)
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
