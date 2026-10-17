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
  const pilar = await servicio
    .from("categorias")
    .select("id, nombre")
    .eq("activa", true)
    .order("nombre")
    .limit(1)
    .single()
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

test("hiding the last claim of a topic removes it and sends Coni back to the topics list without an error", async ({
  page,
}) => {
  const autor = await sembrarAutor("Autor De Tema Efimero")
  const material = await sembrarMaterialListo(autor)
  const tema = await sembrarTema("Tema Efimero")
  const unica = await sembrarAfirmacionDe(material, autor, tema, { texto: "La unica del tema efimero." })

  await page.goto(`/temas/${tema}`)
  await page.getByRole("button", { name: "Ocultar" }).click()

  await expect(page).toHaveURL(/\/temas$/)
  await expect(page.getByRole("heading", { name: "Temas" })).toBeVisible()
  await expect(page.getByText(`${PREFIJO_DE_PRUEBA}Tema Efimero`)).toHaveCount(0)
  const gone = await clienteDeServicio().from("temas").select("id").eq("id", tema)
  expect(gone.data).toEqual([])
  const { data } = await clienteDeServicio().from("afirmaciones").select("excluida").eq("id", unica).single()
  expect(data?.excluida).toBe(true)
  await page.goto(`/autores/${autor}`)
  await expect(page.getByRole("heading", { name: "Ocultas" })).toBeVisible()
})

test("Coni opens a topic that does not exist and lands on the topics list", async ({ page }) => {
  await page.goto("/temas/00000000-0000-4000-8000-000000000000")
  await expect(page).toHaveURL(/\/temas$/)
})

test("a merged topic leads to the topic that absorbed it", async ({ page }) => {
  const viejo = await sembrarTema("Tema Absorbido")
  const vivo = await sembrarTema("Tema Sobreviviente")
  const { error } = await clienteDeServicio().from("temas").update({ fusionado_en: vivo }).eq("id", viejo)
  if (error) throw new Error(error.message)

  await page.goto(`/temas/${viejo}`)

  await expect(page).toHaveURL(new RegExp(`/temas/${vivo}$`))
  await expect(page.getByRole("heading", { name: `${PREFIJO_DE_PRUEBA}Tema Sobreviviente` })).toBeVisible()
})

test("a retired or unknown pillar in the address is ignored: no filter, the picker shows all", async ({ page }) => {
  const retirado = await clienteDeServicio().from("categorias").select("id").eq("activa", false).limit(1).single()
  if (retirado.error) throw new Error(retirado.error.message)
  const autor = await sembrarAutor("Autor De Pilar Retirado")
  const material = await sembrarMaterialListo(autor)
  const suelto = await sembrarTema("Tema Sin Pilar Retirado")
  await sembrarAfirmacionDe(material, autor, suelto)

  for (const id of [retirado.data.id, "00000000-0000-4000-8000-000000000000"]) {
    await page.goto(`/temas?pilar=${id}`)
    await expect(page.getByLabel("Pilar")).toHaveValue("")
    await expect(page.getByRole("link", { name: "Quitar filtros" })).toHaveCount(0)
    await expect(
      page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}Tema Sin Pilar Retirado` }),
    ).toBeVisible()
  }
})
