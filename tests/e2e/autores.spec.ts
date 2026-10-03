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

test("Coni sees each author with its numbers and top topics, and opens one to read its claims by topic", async ({
  page,
}) => {
  const autorId = await sembrarAutor("Autora Con Temas")
  const material = await sembrarMaterialListo(autorId)
  const apego = await sembrarTema("Apego Autores")
  const deseo = await sembrarTema("Deseo Autores")
  await sembrarAfirmacionDe(material, autorId, apego)
  await sembrarAfirmacionDe(material, autorId, apego, { texto: "Otra sobre apego." })
  await sembrarAfirmacionDe(material, autorId, deseo, {
    texto: "Una sobre deseo.",
    ubicacion: { segundo: 75, pista: "voz" },
  })
  const oculta = await sembrarAfirmacionDe(material, autorId, null, { texto: "Esta quedó oculta.", excluida: true })

  await page.goto("/")
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Autores" }).click()
  await expect(page).toHaveURL(/\/autores$/)
  const tarjeta = page
    .getByRole("listitem")
    .filter({ hasText: `${PREFIJO_DE_PRUEBA}Autora Con Temas` })
    .first()
  await expect(tarjeta.getByText("1 material · 3 afirmaciones")).toBeVisible()
  await expect(tarjeta.getByText(`${PREFIJO_DE_PRUEBA}Apego Autores`)).toBeVisible()
  await capturar(page, "ingesta-autores", CARPETA_DE_DOCUMENTACION)

  await tarjeta.getByRole("link").click()
  await expect(page).toHaveURL(new RegExp(`/autores/${autorId}$`))
  await expect(page.getByRole("heading", { name: `${PREFIJO_DE_PRUEBA}Autora Con Temas` })).toBeVisible()
  await expect(page.getByRole("heading", { name: `${PREFIJO_DE_PRUEBA}Apego Autores` })).toBeVisible()
  await expect(page.getByText("Otra sobre apego.")).toBeVisible()
  await expect(page.getByText("Una sobre deseo.")).toBeVisible()
  await page.getByRole("listitem").filter({ hasText: "Una sobre deseo." }).getByText("Ver cita").click()
  await expect(page.getByText("1:15")).toBeVisible()

  // A hidden claim is restored from here: hiding it detached it from its topic, so its topic page cannot show it.
  await expect(page.getByRole("heading", { name: "Ocultas" })).toBeVisible()
  await page.getByRole("button", { name: "Mostrar" }).click()
  await expect(page.getByRole("heading", { name: "Ocultas" })).toHaveCount(0)
  const { data } = await clienteDeServicio().from("afirmaciones").select("excluida").eq("id", oculta).single()
  expect(data?.excluida).toBe(false)
})

test("Coni joins an author into another after an in-page confirmation, and the claims follow", async ({ page }) => {
  const origen = await sembrarAutor("Autor Repetido")
  const destino = await sembrarAutor("Autor Principal")
  const material = await sembrarMaterialListo(origen)
  const afirmacion = await sembrarAfirmacionDe(material, origen, null)

  await page.goto(`/autores/${origen}`)
  await page.getByRole("button", { name: "Unir con otro autor" }).click()
  await expect(page.getByText(/No se puede deshacer/)).toBeVisible()
  await page.getByRole("button", { name: "Cancelar" }).click()
  const intacto = await clienteDeServicio().from("autores").select("id").eq("id", origen)
  expect(intacto.data).toHaveLength(1)

  await page.getByRole("button", { name: "Unir con otro autor" }).click()
  await page.getByLabel("Unir con").selectOption(destino)
  await page.getByRole("button", { name: "Sí, unir" }).click()

  await expect(page).toHaveURL(new RegExp(`/autores/${destino}$`))
  await expect(page.getByText("El apego se aprende en la infancia.")).toBeVisible()
  const { data } = await clienteDeServicio().from("afirmaciones").select("autor_id").eq("id", afirmacion).single()
  expect(data?.autor_id).toBe(destino)
  const borrado = await clienteDeServicio().from("autores").select("id").eq("id", origen)
  expect(borrado.data).toEqual([])
  expect((await page.goto(`/autores/${origen}`))?.status()).toBe(404)
})

test("the graph and theory routes are gone", async ({ page }) => {
  expect((await page.goto("/grafo"))?.status()).toBe(404)
  expect((await page.goto("/teorias"))?.status()).toBe(404)
})
