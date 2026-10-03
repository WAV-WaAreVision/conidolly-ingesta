import { expect, test } from "@playwright/test"
import {
  capturar,
  clienteDeServicio,
  disparosRegistrados,
  limpiarDisparos,
  objetosDelAlmacen,
  PDF_MINIMO,
  PNG_MINIMO,
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

test("Coni uploads a PDF straight to the store and sees it as Procesando", async ({ page }) => {
  const titulo = `${PREFIJO_DE_PRUEBA}Apego adulto`
  await page.goto("/")
  await page.getByRole("link", { name: "Subir material" }).click()
  await expect(page).toHaveURL(/\/subir$/)
  await expect(page.getByRole("heading", { name: "Subir material" })).toBeVisible()

  await page.getByLabel("Archivo").setInputFiles({ name: "apego.pdf", mimeType: "application/pdf", buffer: PDF_MINIMO })
  await page.getByLabel(/^Título/).fill(titulo)
  await page.getByLabel(/^Autor/).fill("Esther Perel")
  await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "General" })
  await page.getByLabel("Etiquetas").fill("apego, pareja")
  await page.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }).check()
  await page.evaluate(() => window.scrollTo(0, 0))
  await capturar(page, "ingesta-subir", CARPETA_DE_DOCUMENTACION)

  await page.getByRole("button", { name: "Subir material" }).click()

  await expect(page).toHaveURL(/\/$/)
  const tarjeta = page.getByRole("listitem").filter({ hasText: titulo })
  await expect(tarjeta).toBeVisible()
  await expect(tarjeta.getByText("Procesando")).toBeVisible()

  const material = await filaPorTitulo(titulo)
  expect(material).toMatchObject({ tipo: "documento", estado: "procesando", autor: "Esther Perel" })
  expect(material.etiquetas).toEqual(["apego", "pareja"])
  expect(material.archivo_clave).toMatch(/^materiales\/[0-9a-f-]{36}\/original\.pdf$/)
  const objetos = await objetosDelAlmacen()
  expect(objetos[`/${BALDE_DE_PRUEBA}/${material.archivo_clave}`]).toEqual({
    bytes: PDF_MINIMO.byteLength,
    tipo: "application/pdf",
    firmada: true,
  })
  expect(disparosRegistrados()).toEqual([{ tarea: "procesar-material", materialId: material.id }])
  await capturar(page, "ingesta-materiales")
})

test("Coni uploads two images in the order she chose", async ({ page }) => {
  const titulo = `${PREFIJO_DE_PRUEBA}Carrusel`
  await page.goto("/subir")
  await page.getByRole("radio", { name: "Imagen" }).check({ force: true })
  await expect(page.getByText("Ej: @cuenta")).toBeVisible()

  await page.getByLabel("Imágenes").setInputFiles([
    { name: "primera.png", mimeType: "image/png", buffer: PNG_MINIMO },
    { name: "segunda.png", mimeType: "image/png", buffer: PNG_MINIMO },
  ])
  await expect(page.getByRole("listitem")).toHaveCount(2)
  await page.getByRole("button", { name: "Mover la imagen 2 antes" }).click()
  await expect(page.getByRole("listitem").first()).toHaveAttribute("data-nombre", "segunda.png")
  await page.getByLabel(/^Título/).fill(titulo)
  await page.getByLabel(/^Autor/).fill("@cuenta_referente")
  await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "General" })
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

test("Coni adds a category from the form and uses it", async ({ page }) => {
  const nombre = `${PREFIJO_DE_PRUEBA}Apego ${Date.now()}`
  await page.goto("/subir")

  await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "Agregar categoría nueva" })
  await page.getByLabel("Nombre de la categoría").fill(nombre)
  await page.getByRole("button", { name: "Agregar", exact: true }).click()

  await expect(page.getByLabel("Categoría", { exact: true })).toHaveValue(/[0-9a-f-]{36}/)
  await expect(page.getByLabel("Categoría", { exact: true }).locator("option:checked")).toHaveText(nombre)
  const { error } = await clienteDeServicio().from("categorias").delete().eq("nombre", nombre)
  expect(error).toBeNull()
})

test("a link needs no file: it is saved and processed right away", async ({ page }) => {
  const titulo = `${PREFIJO_DE_PRUEBA}Nota`
  await page.goto("/subir")
  await page.getByRole("radio", { name: "Link" }).check({ force: true })
  await page.getByLabel("Dirección del link").fill("https://example.com/nota")
  await page.getByLabel(/^Título/).fill(titulo)
  await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "General" })

  await page.getByRole("button", { name: "Subir material" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "Marca que el material no contiene datos de pacientes." }),
  ).toBeVisible()
  await page.getByRole("checkbox", { name: "Este material no contiene datos de pacientes" }).check()
  await page.getByRole("button", { name: "Subir material" }).click()

  await expect(page).toHaveURL(/\/$/)
  const material = await filaPorTitulo(titulo)
  expect(material).toMatchObject({ tipo: "link", origen_url: "https://example.com/nota", archivo_clave: null })
  expect(disparosRegistrados()).toEqual([{ tarea: "procesar-material", materialId: material.id }])
})
