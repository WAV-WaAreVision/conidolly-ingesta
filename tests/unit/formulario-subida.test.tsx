import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  confirmarMaterialAccion,
  crearAutorAccion,
  crearMaterialAccion,
  descartarMaterialAccion,
} from "@/app/(app)/subir/acciones"
import { FormularioSubida } from "@/app/(app)/subir/formulario-subida"

const irA = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: irA, refresh: vi.fn() }) }))
vi.mock("@/app/(app)/subir/acciones", () => ({
  crearMaterialAccion: vi.fn(),
  confirmarMaterialAccion: vi.fn(),
  descartarMaterialAccion: vi.fn(),
  crearAutorAccion: vi.fn(),
}))

const crear = vi.mocked(crearMaterialAccion)
const confirmar = vi.mocked(confirmarMaterialAccion)
const descartar = vi.mocked(descartarMaterialAccion)
const crearAutor = vi.mocked(crearAutorAccion)

const AUTORES = [
  {
    id: "11111111-2222-4333-8444-555555555551",
    nombre: "Esther Perel",
    credencial: "Psicoterapeuta",
    tipo: "persona",
    alias: [],
  },
  {
    id: "11111111-2222-4333-8444-555555555552",
    nombre: "Constanza del Rosario",
    credencial: null,
    tipo: "coni",
    alias: [],
  },
]
const MATERIAL = "99999999-2222-4333-8444-555555555555"

function archivo(nombre: string, tipo = "application/pdf", tamano?: number) {
  const f = new File(["contenido"], nombre, { type: tipo })
  if (tamano !== undefined) Object.defineProperty(f, "size", { value: tamano })
  return f
}

function elegirArchivos(etiqueta: string, archivos: File[]) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { files: archivos } })
}

function elegirTipo(nombre: string) {
  fireEvent.click(screen.getByRole("radio", { name: nombre }))
}

function elegirAutor(nombre = "Esther Perel") {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(nombre) }))
}

function elegirRol(nombre = "Referente") {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(nombre) }))
}

function completarLoBasico() {
  elegirAutor()
  elegirRol()
  fireEvent.click(screen.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }))
}

const enviar = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("fetch", enviar)
  enviar.mockResolvedValue(new Response(null, { status: 200 }))
  URL.createObjectURL = vi.fn((f: Blob | MediaSource) => `blob:${f instanceof File ? f.name : "x"}`)
  URL.revokeObjectURL = vi.fn()
})

describe("FormularioSubida: tipos", () => {
  it("offers the six types and starts on documento", () => {
    render(<FormularioSubida autores={AUTORES} />)

    const tipos = within(screen.getByRole("radiogroup", { name: "Tipo de material" })).getAllByRole("radio")
    expect(tipos.map((t) => t.getAttribute("aria-label") ?? t.closest("label")?.textContent)).toEqual([
      "Documento",
      "Link",
      "Audio",
      "Video",
      "Imagen",
      "Post",
    ])
    expect(screen.getByRole("radio", { name: "Documento" })).toBeChecked()
    expect(screen.getByLabelText("Archivo")).toBeInTheDocument()
  })

  it("asks for the address for a link, with no file", () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Link")

    expect(screen.getByLabelText("Dirección del link")).toBeInTheDocument()
    expect(screen.queryByLabelText("Archivo")).not.toBeInTheDocument()
  })

  it("shows the steps and a required transcript field only for a YouTube link", () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Link")
    expect(screen.queryByLabelText("Transcripción del video")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Dirección del link"), { target: { value: "https://youtu.be/abc123" } })

    expect(screen.getByLabelText("Transcripción del video")).toBeRequired()
    expect(screen.getByText(/Mostrar transcripción/)).toBeInTheDocument()
  })

  it("asks for the pasted text and an optional video for a post", () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Post")

    expect(screen.getByLabelText("Texto del post")).toBeInTheDocument()
    expect(screen.getByLabelText("Video (opcional)")).toBeInTheDocument()
  })

  it.each(["Video", "Imagen"])("offers a reference link for %s", (tipo) => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo(tipo)

    expect(screen.getByLabelText("Link de referencia (no se abre)")).toBeInTheDocument()
  })

  it("does not offer a reference link for a document", () => {
    render(<FormularioSubida autores={AUTORES} />)

    expect(screen.queryByLabelText("Link de referencia (no se abre)")).not.toBeInTheDocument()
  })
})

describe("FormularioSubida: autor y rol", () => {
  it("has no category and no tags any more", () => {
    render(<FormularioSubida autores={AUTORES} />)

    expect(screen.queryByLabelText("Categoría")).toBeNull()
    expect(screen.queryByLabelText("Etiquetas")).toBeNull()
  })

  it("offers the four roles with one line of help each, and none picked", () => {
    render(<FormularioSubida autores={AUTORES} />)

    const roles = within(screen.getByRole("radiogroup", { name: "Papel del material" })).getAllByRole("radio")
    expect(roles.map((rol) => rol.closest("label")?.querySelector("span")?.textContent)).toEqual([
      "Lo dijo Coni",
      "Referente",
      "Estudio o libro",
      "Estrategia interna",
    ])
    for (const rol of roles) expect(rol).not.toBeChecked()
    expect(screen.getByText("Un estudio, libro o artículo que respalda con datos lo que se dice.")).toBeInTheDocument()
  })

  it("picks Coni as the author when she chooses 'Lo dijo Coni' and no author is chosen yet", () => {
    render(<FormularioSubida autores={AUTORES} />)

    elegirRol("Lo dijo Coni")

    expect(screen.getByText("Constanza del Rosario")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cambiar autor" })).toBeInTheDocument()
  })

  it("keeps the author already chosen when she picks 'Lo dijo Coni'", () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirAutor("Esther Perel")

    elegirRol("Lo dijo Coni")

    expect(screen.getByText("Esther Perel")).toBeInTheDocument()
    expect(screen.queryByText("Constanza del Rosario")).toBeNull()
  })

  it("does not pick any author for the other roles", () => {
    render(<FormularioSubida autores={AUTORES} />)

    elegirRol("Referente")

    expect(screen.queryByRole("button", { name: "Cambiar autor" })).toBeNull()
  })

  it("searches the authors and creates a new one through the action", async () => {
    crearAutor.mockResolvedValue({
      ok: true,
      autor: { id: "nuevo-id", nombre: "Brené Brown", credencial: null, tipo: "persona", alias: [] },
    })
    render(<FormularioSubida autores={AUTORES} />)

    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Brené Brown" } })
    fireEvent.click(screen.getByRole("button", { name: "Autor nuevo" }))
    fireEvent.click(screen.getByRole("button", { name: "Crear autor" }))

    await waitFor(() =>
      expect(crearAutor).toHaveBeenCalledWith({ nombre: "Brené Brown", credencial: "", tipo: "persona" }),
    )
    expect(await screen.findByRole("button", { name: "Cambiar autor" })).toBeInTheDocument()
  })

  it("does not send the form when Enter is pressed in the author search", () => {
    render(<FormularioSubida autores={AUTORES} />)

    fireEvent.keyDown(screen.getByLabelText("Autor"), { key: "Enter" })

    expect(crear).not.toHaveBeenCalled()
  })
})

describe("FormularioSubida: reglas antes de subir", () => {
  it("does not start without the declaration of no patient data", async () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    elegirAutor()
    elegirRol()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("Marca que el material no contiene datos de pacientes.")).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it("refuses a file over 2 GB right away", () => {
    render(<FormularioSubida autores={AUTORES} />)

    elegirArchivos("Archivo", [archivo("clase.mp4", "video/mp4", 2 * 1024 ** 3 + 1)])

    expect(screen.getByRole("alert")).toHaveTextContent("Ese archivo pesa más de 2 GB.")
    expect(screen.queryByText("clase.mp4")).not.toBeInTheDocument()
  })

  it("asks for an author before starting", async () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    elegirRol()
    fireEvent.click(screen.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }))

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("Elige el autor.")).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it("asks for a role before starting", async () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    elegirAutor()
    fireEvent.click(screen.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }))

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("Elige qué papel cumple este material.")).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })
})

describe("FormularioSubida: imágenes", () => {
  const fotos = ["a.jpg", "b.jpg", "c.jpg"].map((nombre) => archivo(nombre, "image/jpeg"))

  const fotosEnLista = () => Array.from(document.querySelectorAll("li[data-nombre]"))

  function nombresEnOrden() {
    return fotosEnLista().map((item) => item.getAttribute("data-nombre"))
  }

  it("shows thumbnails in the order chosen and lets her move and remove them", () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Imagen")
    elegirArchivos("Imágenes", fotos)

    expect(nombresEnOrden()).toEqual(["a.jpg", "b.jpg", "c.jpg"])
    expect(screen.getAllByRole("img")).toHaveLength(3)

    fireEvent.click(screen.getByRole("button", { name: "Mover la imagen 2 antes" }))
    expect(nombresEnOrden()).toEqual(["b.jpg", "a.jpg", "c.jpg"])

    fireEvent.click(screen.getByRole("button", { name: "Mover la imagen 2 después" }))
    expect(nombresEnOrden()).toEqual(["b.jpg", "c.jpg", "a.jpg"])

    fireEvent.click(screen.getByRole("button", { name: "Quitar la imagen 1" }))
    expect(nombresEnOrden()).toEqual(["c.jpg", "a.jpg"])
  })

  it("cannot move the first one earlier nor the last one later", () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Imagen")
    elegirArchivos("Imágenes", fotos)

    expect(screen.getByRole("button", { name: "Mover la imagen 1 antes" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("button", { name: "Mover la imagen 3 después" })).toHaveAttribute("aria-disabled", "true")
  })

  it("keeps the first twenty and says so when she picks more", () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Imagen")
    elegirArchivos(
      "Imágenes",
      Array.from({ length: 22 }, (_, i) => archivo(`${i}.jpg`, "image/jpeg")),
    )

    expect(fotosEnLista()).toHaveLength(20)
    expect(screen.getByRole("alert")).toHaveTextContent("Puedes subir hasta 20 imágenes.")
  })
})

describe("FormularioSubida: subir", () => {
  it("creates the material, puts the file to the signed URL, confirms and goes to the list", async () => {
    crear.mockResolvedValue({
      ok: true,
      materialId: MATERIAL,
      subidas: [{ orden: 1, url: "https://r2.test/firmada", tipoContenido: "application/pdf" }],
    })
    confirmar.mockResolvedValue({ ok: true })
    render(<FormularioSubida autores={AUTORES} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Apego adulto" } })
    elegirAutor()
    elegirRol("Estudio o libro")
    fireEvent.click(screen.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }))

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith("/"))
    expect(crear).toHaveBeenCalledWith({
      tipo: "documento",
      titulo: "Apego adulto",
      autorId: AUTORES[0]?.id,
      rol: "evidencia",
      declaracion: true,
      url: "",
      textoPegado: "",
      referencia: "",
      archivos: [{ nombre: "tesis.pdf", tamano: 9 }],
    })
    expect(enviar).toHaveBeenCalledWith("https://r2.test/firmada", {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: expect.any(File),
    })
    expect(confirmar).toHaveBeenCalledWith({ materialId: MATERIAL })
    expect(descartar).not.toHaveBeenCalled()
  })

  it("sends the images in the order she left them", async () => {
    crear.mockResolvedValue({
      ok: true,
      materialId: MATERIAL,
      subidas: [
        { orden: 1, url: "https://r2.test/1", tipoContenido: "image/jpeg" },
        { orden: 2, url: "https://r2.test/2", tipoContenido: "image/jpeg" },
      ],
    })
    confirmar.mockResolvedValue({ ok: true })
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Imagen")
    elegirArchivos("Imágenes", [archivo("a.jpg", "image/jpeg"), archivo("b.jpg", "image/jpeg")])
    fireEvent.click(screen.getByRole("button", { name: "Mover la imagen 2 antes" }))
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    await waitFor(() => expect(confirmar).toHaveBeenCalled())
    expect(crear.mock.calls[0]?.[0]).toMatchObject({ archivos: [{ nombre: "b.jpg" }, { nombre: "a.jpg" }] })
    const cuerpos = enviar.mock.calls.map(([, opciones]) => (opciones as { body: File }).body.name)
    expect(cuerpos).toEqual(["b.jpg", "a.jpg"])
  })

  it("needs no upload for a link: it creates and confirms", async () => {
    crear.mockResolvedValue({ ok: true, materialId: MATERIAL, subidas: [] })
    confirmar.mockResolvedValue({ ok: true })
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Link")
    fireEvent.change(screen.getByLabelText("Dirección del link"), { target: { value: "https://example.com/nota" } })
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith("/"))
    expect(crear.mock.calls[0]?.[0]).toMatchObject({ tipo: "link", url: "https://example.com/nota", archivos: [] })
    expect(enviar).not.toHaveBeenCalled()
  })

  it("cannot submit a bare YouTube link: it asks for the transcript and calls nothing", async () => {
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Link")
    fireEvent.change(screen.getByLabelText("Dirección del link"), { target: { value: "https://youtu.be/abc123" } })
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Pega la transcripción del video.")
    expect(crear).not.toHaveBeenCalled()
  })

  it("sends the YouTube address together with the pasted transcript", async () => {
    crear.mockResolvedValue({ ok: true, materialId: MATERIAL, subidas: [] })
    confirmar.mockResolvedValue({ ok: true })
    render(<FormularioSubida autores={AUTORES} />)
    elegirTipo("Link")
    fireEvent.change(screen.getByLabelText("Dirección del link"), { target: { value: "https://youtu.be/abc123" } })
    fireEvent.change(screen.getByLabelText("Transcripción del video"), { target: { value: "Hola a todos" } })
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith("/"))
    expect(crear.mock.calls[0]?.[0]).toMatchObject({
      tipo: "link",
      url: "https://youtu.be/abc123",
      textoPegado: "Hola a todos",
    })
  })

  it("shows the error of the server and uploads nothing", async () => {
    crear.mockResolvedValue({ ok: false, error: "Esta app es solo para Coni y WAV." })
    render(<FormularioSubida autores={AUTORES} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("Esta app es solo para Coni y WAV.")).toBeInTheDocument()
    expect(enviar).not.toHaveBeenCalled()
    expect(irA).not.toHaveBeenCalled()
  })

  it("discards the material and says what happened when the upload fails", async () => {
    crear.mockResolvedValue({
      ok: true,
      materialId: MATERIAL,
      subidas: [{ orden: 1, url: "https://r2.test/firmada", tipoContenido: "application/pdf" }],
    })
    descartar.mockResolvedValue({ ok: true })
    enviar.mockResolvedValue(new Response(null, { status: 403 }))
    render(<FormularioSubida autores={AUTORES} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(
      await screen.findByText("No pude subir tesis.pdf. Revisa tu conexión e inténtalo de nuevo."),
    ).toBeInTheDocument()
    expect(descartar).toHaveBeenCalledWith({ materialId: MATERIAL })
    expect(confirmar).not.toHaveBeenCalled()
    expect(irA).not.toHaveBeenCalled()
  })

  it("shows the error when the server cannot confirm the upload", async () => {
    crear.mockResolvedValue({
      ok: true,
      materialId: MATERIAL,
      subidas: [{ orden: 1, url: "https://r2.test/firmada", tipoContenido: "application/pdf" }],
    })
    confirmar.mockResolvedValue({ ok: false, error: "No encontré el archivo que subiste. Inténtalo de nuevo." })
    render(<FormularioSubida autores={AUTORES} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("No encontré el archivo que subiste. Inténtalo de nuevo.")).toBeInTheDocument()
    expect(irA).not.toHaveBeenCalled()
  })
})
