import { expect, type Page, test } from "@playwright/test"
import {
  capturar,
  clienteDeServicio,
  disparosRegistrados,
  limpiarDisparos,
  objetosDelAlmacen,
  PDF_MINIMO,
  PNG_MINIMO,
  sembrarAutor,
} from "./ayudas"
import { BALDE_DE_PRUEBA, CARPETA_DE_DOCUMENTACION, PREFIJO_DE_PRUEBA } from "./entorno"

test.beforeEach(() => {
  limpiarDisparos()
})

async function filaPorTitulo(titulo: string) {
  const { data, error } = await clienteDeServicio().from("materiales").select("*").eq("titulo", titulo).single()
  if (error) throw new Error(error.message)
  return data
}

async function elegirAutorYPapel(page: Page, autor: string, papel: RegExp) {
  await page.getByLabel("Autor", { exact: true }).fill(autor)
  await page.getByRole("button", { name: new RegExp(autor) }).click()
  await page.getByRole("radio", { name: papel }).check({ force: true })
}

test("Coni uploads a PDF straight to the store and sees it as Procesando", async ({ page }) => {
  const titulo = `${PREFIJO_DE_PRUEBA}Apego adulto`
  const autorId = await sembrarAutor("Esther Perel")
  await page.goto("/")
  await page.getByRole("link", { name: "Subir material" }).click()
  await expect(page).toHaveURL(/\/subir$/)
  await expect(page.getByRole("heading", { name: "Subir material" })).toBeVisible()

  await page.getByLabel("Archivo").setInputFiles({ name: "apego.pdf", mimeType: "application/pdf", buffer: PDF_MINIMO })
  await page.getByLabel(/^Título/).fill(titulo)
  await elegirAutorYPapel(page, `${PREFIJO_DE_PRUEBA}Esther Perel`, /Estudio o libro/)
  await page.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }).check()
  await page.evaluate(() => window.scrollTo(0, 0))
  await capturar(page, "ingesta-subir", CARPETA_DE_DOCUMENTACION)

  await page.getByRole("button", { name: "Subir material" }).click()

  await expect(page).toHaveURL(/\/$/)
  const tarjeta = page.getByRole("listitem").filter({ hasText: titulo })
  await expect(tarjeta).toBeVisible()
  await expect(tarjeta.getByText("Procesando")).toBeVisible()

  const material = await filaPorTitulo(titulo)
  expect(material).toMatchObject({ tipo: "documento", estado: "procesando", autor_id: autorId, rol: "evidencia" })
  expect(material.archivo_clave).toMatch(/^materiales\/[0-9a-f-]{36}\/original\.pdf$/)
  const objetos = await objetosDelAlmacen()
  expect(objetos[`/${BALDE_DE_PRUEBA}/${material.archivo_clave}`]).toEqual({
    bytes: PDF_MINIMO.byteLength,
    tipo: "application/pdf",
    firmada: true,
  })
  expect(disparosRegistrados()).toEqual([{ tarea: "procesar-material", materialId: material.id }])
})

test("Coni uploads two images in the order she chose", async ({ page }) => {
  const titulo = `${PREFIJO_DE_PRUEBA}Carrusel`
  await sembrarAutor("@cuenta_referente", "cuenta")
  await page.goto("/subir")
  await page.getByRole("radio", { name: "Imagen" }).check({ force: true })
  await expect(page.getByLabel("Link de referencia (no se abre)")).toBeVisible()

  await page.getByLabel("Imágenes").setInputFiles([
    { name: "primera.png", mimeType: "image/png", buffer: PNG_MINIMO },
    { name: "segunda.png", mimeType: "image/png", buffer: PNG_MINIMO },
  ])
  await expect(page.locator("li[data-nombre]")).toHaveCount(2)
  await page.getByRole("button", { name: "Mover la imagen 2 antes" }).click()
  await expect(page.locator("li[data-nombre]").first()).toHaveAttribute("data-nombre", "segunda.png")
  await page.getByLabel(/^Título/).fill(titulo)
  await elegirAutorYPapel(page, `${PREFIJO_DE_PRUEBA}@cuenta_referente`, /Referente/)
  await page.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }).check()

  await page.getByRole("button", { name: "Subir material" }).click()

  await expect(page).toHaveURL(/\/$/)
  const material = await filaPorTitulo(titulo)
  const { data } = await clienteDeServicio()
    .from("materiales_archivos")
    .select("orden, archivo_clave")
    .eq("material_id", material.id)
    .order("orden")
  expect(data?.map((a) => a.orden)).toEqual([1, 2])
  expect(material.archivo_clave).toBe(data?.[0]?.archivo_clave)
  const objetos = await objetosDelAlmacen()
  for (const archivo of data ?? [])
    expect(objetos[`/${BALDE_DE_PRUEBA}/${archivo.archivo_clave}`]?.tipo).toBe("image/png")
  expect(disparosRegistrados()).toEqual([{ tarea: "procesar-material", materialId: material.id }])
})

test("a link needs no file: it is saved and processed right away", async ({ page }) => {
  const titulo = `${PREFIJO_DE_PRUEBA}Nota`
  await sembrarAutor("Autor del link")
  await page.goto("/subir")
  await page.getByRole("radio", { name: "Link" }).check({ force: true })
  await page.getByLabel("Dirección del link").fill("https://example.com/nota")
  await page.getByLabel(/^Título/).fill(titulo)
  await elegirAutorYPapel(page, `${PREFIJO_DE_PRUEBA}Autor del link`, /Lo dijo Coni/)

  await page.getByRole("button", { name: "Subir material" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "Marca que el material no contiene datos de pacientes." }),
  ).toBeVisible()
  await page.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }).check()
  await page.getByRole("button", { name: "Subir material" }).click()

  await expect(page).toHaveURL(/\/$/)
  const material = await filaPorTitulo(titulo)
  expect(material).toMatchObject({
    tipo: "link",
    origen_url: "https://example.com/nota",
    archivo_clave: null,
    rol: "voz_propia",
  })
  expect(disparosRegistrados()).toEqual([{ tarea: "procesar-material", materialId: material.id }])
})
