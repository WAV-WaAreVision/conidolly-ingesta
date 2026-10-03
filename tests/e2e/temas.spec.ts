import { expect, test } from "@playwright/test"
import {
  capturar,
  clienteDeServicio,
  sembrarAfirmacionDe,
  sembrarAutor,
  sembrarMaterialListo,
  sembrarTema,
} from "./ayudas"
import { CARPETA_DE_DOCUMENTACION, PREFIJO_DE_PRUEBA } from "./entorno"

test("Coni sees the topics ordered by authors, with badges and the evidence mix, filters by pillar and opens one", async ({
  page,
}) => {
  const servicio = clienteDeServicio()
  const pilar = await servicio.from("categorias").select("id, nombre").order("nombre").limit(1).single()
  if (pilar.error) throw new Error(pilar.error.message)
  const [uno, dos] = await Promise.all([sembrarAutor("Autor Uno Temas"), sembrarAutor("Autor Dos Temas")])
  const [m1, m2] = await Promise.all([sembrarMaterialListo(uno, "voz_propia"), sembrarMaterialListo(dos)])
  const compartido = await sembrarTema("Tema Compartido", {
    descripcion: "Lo que ambos dicen.",
    categoria_id: pilar.data.id,
  })
  const solitario = await sembrarTema("Tema Solitario")
  const visible = await sembrarAfirmacionDe(m1, uno, compartido, {
    texto: "Primera del compartido.",
    gancho: "Un gancho claro",
  })
  await sembrarAfirmacionDe(m2, dos, compartido, { texto: "Segunda del compartido.", evidencia: "clinica" })
  await sembrarAfirmacionDe(m2, dos, solitario)
  const tarjeta = (nombre: string) => page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}${nombre}` })

  await page.goto("/")
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Temas" }).click()
  await expect(page).toHaveURL(/\/temas$/)
  await expect(tarjeta("Tema Compartido").getByText("Coni ya lo trató")).toBeVisible()
  await expect(tarjeta("Tema Compartido").getByText("2 afirmaciones · 2 autores")).toBeVisible()
  await expect(tarjeta("Tema Compartido").getByText("Clínica 1 · Estudio 1")).toBeVisible()
  await expect(tarjeta("Tema Solitario").getByText("Un solo autor")).toBeVisible()
  const nombres = await page.getByRole("listitem").filter({ hasText: PREFIJO_DE_PRUEBA }).allInnerTexts()
  expect(nombres.findIndex((t) => t.includes("Tema Compartido"))).toBeLessThan(
    nombres.findIndex((t) => t.includes("Tema Solitario")),
  )
  await capturar(page, "ingesta-temas", CARPETA_DE_DOCUMENTACION)

  await page.getByLabel("Pilar").selectOption(pilar.data.id)
  await page.getByRole("button", { name: "Filtrar" }).click()
  await expect(page).toHaveURL(new RegExp(`pilar=${pilar.data.id}`))
  await expect(tarjeta("Tema Compartido")).toBeVisible()
  await expect(tarjeta("Tema Solitario")).toHaveCount(0)
  await page.getByRole("link", { name: "Quitar filtros" }).click()
  await expect(tarjeta("Tema Solitario")).toBeVisible()

  await tarjeta("Tema Compartido").getByRole("link").click()
  await expect(page.getByRole("heading", { name: `${PREFIJO_DE_PRUEBA}Tema Compartido` })).toBeVisible()
  await expect(page.getByText("Lo que ambos dicen.")).toBeVisible()
  await expect(page.getByRole("heading", { name: `${PREFIJO_DE_PRUEBA}Autor Uno Temas` })).toBeVisible()
  await expect(page.getByRole("heading", { name: `${PREFIJO_DE_PRUEBA}Autor Dos Temas` })).toBeVisible()
  await expect(page.getByText("Gancho:")).toBeVisible()
  await expect(page.getByText("Primera del compartido.")).toBeVisible()
  await expect(page.getByText("El apego se aprende en la infancia, escribió ella.").first()).toBeHidden()
  await page.getByText("Ver cita").first().click()
  await expect(page.getByText("El apego se aprende en la infancia, escribió ella.").first()).toBeVisible()

  await page
    .getByRole("listitem")
    .filter({ hasText: "Primera del compartido." })
    .getByRole("button", { name: "Ocultar" })
    .click()
  await expect(page.getByText("Primera del compartido.")).toHaveCount(0)
  const { data } = await servicio.from("afirmaciones").select("excluida, tema_id").eq("id", visible).single()
  expect(data).toEqual({ excluida: true, tema_id: null })
})

test("Coni opens a topic that does not exist and finds a 404", async ({ page }) => {
  expect((await page.goto("/temas/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404)
})
