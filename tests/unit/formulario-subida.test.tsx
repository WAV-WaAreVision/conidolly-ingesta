import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  confirmarMaterialAccion,
  crearCategoriaAccion,
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
  crearCategoriaAccion: vi.fn(),
}))

const crear = vi.mocked(crearMaterialAccion)
const confirmar = vi.mocked(confirmarMaterialAccion)
const descartar = vi.mocked(descartarMaterialAccion)
const crearCategoria = vi.mocked(crearCategoriaAccion)

const CATEGORIAS = [
  { id: "11111111-2222-4333-8444-555555555551", nombre: "Pareja y conversación" },
  { id: "11111111-2222-4333-8444-555555555552", nombre: "General" },
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

function completarLoBasico() {
  fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: CATEGORIAS[0]?.id } })
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
    render(<FormularioSubida categorias={CATEGORIAS} />)

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
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirTipo("Link")

    expect(screen.getByLabelText("Dirección del link")).toBeInTheDocument()
    expect(screen.queryByLabelText("Archivo")).not.toBeInTheDocument()
  })

  it("asks for the pasted text and an optional video for a post", () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirTipo("Post")

    expect(screen.getByLabelText("Texto del post")).toBeInTheDocument()
    expect(screen.getByLabelText("Video (opcional)")).toBeInTheDocument()
  })

  it.each(["Video", "Imagen"])("hints the author as @account and offers a reference link for %s", (tipo) => {
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirTipo(tipo)

    expect(screen.getByText("Ej: @cuenta")).toBeInTheDocument()
    expect(screen.getByLabelText("Link de referencia (no se abre)")).toBeInTheDocument()
  })

  it("does not hint @account nor offer a reference link for a document", () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)

    expect(screen.queryByText("Ej: @cuenta")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Link de referencia (no se abre)")).not.toBeInTheDocument()
  })
})

describe("FormularioSubida: categoría", () => {
  it("lists the categories and ends with the option to add a new one", () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)

    const opciones = within(screen.getByLabelText("Categoría")).getAllByRole("option")
    expect(opciones.map((o) => o.textContent)).toEqual([
      "Elige una categoría",
      "Pareja y conversación",
      "General",
      "Agregar categoría nueva",
    ])
  })

  it("creates the category through the action and selects it", async () => {
    crearCategoria.mockResolvedValue({ ok: true, categoria: { id: "nueva-id", nombre: "Apego" } })
    render(<FormularioSubida categorias={CATEGORIAS} />)

    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "__nueva__" } })
    fireEvent.change(screen.getByLabelText("Nombre de la categoría"), { target: { value: "Apego" } })
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }))

    await waitFor(() => expect(crearCategoria).toHaveBeenCalledWith({ nombre: "Apego" }))
    expect(await screen.findByRole("option", { name: "Apego" })).toBeInTheDocument()
    expect(screen.getByLabelText("Categoría")).toHaveValue("nueva-id")
  })

  it("shows the error when the category cannot be created", async () => {
    crearCategoria.mockResolvedValue({ ok: false, error: "Escribe el nombre de la categoría." })
    render(<FormularioSubida categorias={CATEGORIAS} />)

    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "__nueva__" } })
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }))

    expect(await screen.findByText("Escribe el nombre de la categoría.")).toBeInTheDocument()
  })
})

describe("FormularioSubida: reglas antes de subir", () => {
  it("does not start without the declaration of no patient data", async () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: CATEGORIAS[0]?.id } })

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("Marca que el material no contiene datos de pacientes.")).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it("refuses a file over 2 GB right away", () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)

    elegirArchivos("Archivo", [archivo("clase.mp4", "video/mp4", 2 * 1024 ** 3 + 1)])

    expect(screen.getByRole("alert")).toHaveTextContent("Ese archivo pesa más de 2 GB.")
    expect(screen.queryByText("clase.mp4")).not.toBeInTheDocument()
  })

  it("asks for a category before starting", async () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    fireEvent.click(screen.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }))

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("Elige una categoría.")).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })
})

describe("FormularioSubida: imágenes", () => {
  const fotos = ["a.jpg", "b.jpg", "c.jpg"].map((nombre) => archivo(nombre, "image/jpeg"))

  function nombresEnOrden() {
    return screen.getAllByRole("listitem").map((item) => item.getAttribute("data-nombre"))
  }

  it("shows thumbnails in the order chosen and lets her move and remove them", () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)
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
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirTipo("Imagen")
    elegirArchivos("Imágenes", fotos)

    expect(screen.getByRole("button", { name: "Mover la imagen 1 antes" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("button", { name: "Mover la imagen 3 después" })).toHaveAttribute("aria-disabled", "true")
  })

  it("keeps the first twenty and says so when she picks more", () => {
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirTipo("Imagen")
    elegirArchivos(
      "Imágenes",
      Array.from({ length: 22 }, (_, i) => archivo(`${i}.jpg`, "image/jpeg")),
    )

    expect(screen.getAllByRole("listitem")).toHaveLength(20)
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
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Apego adulto" } })
    fireEvent.change(screen.getByLabelText(/^Autor/), { target: { value: "Esther Perel" } })
    fireEvent.change(screen.getByLabelText("Etiquetas"), { target: { value: "apego, pareja" } })
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith("/"))
    expect(crear).toHaveBeenCalledWith({
      tipo: "documento",
      titulo: "Apego adulto",
      autor: "Esther Perel",
      categoriaId: CATEGORIAS[0]?.id,
      etiquetas: ["apego", "pareja"],
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
    render(<FormularioSubida categorias={CATEGORIAS} />)
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
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirTipo("Link")
    fireEvent.change(screen.getByLabelText("Dirección del link"), { target: { value: "https://example.com/nota" } })
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    await waitFor(() => expect(irA).toHaveBeenCalledWith("/"))
    expect(crear.mock.calls[0]?.[0]).toMatchObject({ tipo: "link", url: "https://example.com/nota", archivos: [] })
    expect(enviar).not.toHaveBeenCalled()
  })

  it("shows the error of the server and uploads nothing", async () => {
    crear.mockResolvedValue({ ok: false, error: "Esta app es solo para Coni y WAV." })
    render(<FormularioSubida categorias={CATEGORIAS} />)
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
    render(<FormularioSubida categorias={CATEGORIAS} />)
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
    render(<FormularioSubida categorias={CATEGORIAS} />)
    elegirArchivos("Archivo", [archivo("tesis.pdf")])
    completarLoBasico()

    fireEvent.click(screen.getByRole("button", { name: "Subir material" }))

    expect(await screen.findByText("No encontré el archivo que subiste. Inténtalo de nuevo.")).toBeInTheDocument()
    expect(irA).not.toHaveBeenCalled()
  })
})
