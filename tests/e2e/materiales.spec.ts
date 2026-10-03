import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import {
  capturar,
  clienteDeServicio,
  disparosRegistrados,
  limpiarDisparos,
  objetosDelAlmacen,
  ponerObjetoEnElAlmacen,
} from "./ayudas"
import { BALDE_DE_PRUEBA, CARPETA_DE_DOCUMENTACION, CORREO_DE_CONI, PREFIJO_DE_PRUEBA } from "./entorno"

test.beforeEach(() => {
  limpiarDisparos()
})

const IDEAS = [
  "El apego se aprende en la infancia.",
  "El deseo necesita distancia.",
  "Conversar no es lo mismo que resolver.",
  "Los límites cuidan el vínculo.",
  "Pedir lo que quieres es un acto de cariño.",
]
const TEXTO_ORIGINAL = "Original text for the test."

async function idDeConi(): Promise<string> {
  const { data, error } = await clienteDeServicio().auth.admin.listUsers()
  const id = data?.users.find((usuario) => usuario.email === CORREO_DE_CONI)?.id
  if (error || !id) throw new Error(`No encontré a ${CORREO_DE_CONI} en el Auth local.`)
  return id
}

async function categoria(slug: string): Promise<string> {
  const { data, error } = await clienteDeServicio().from("categorias").select("id").eq("slug", slug).single()
  if (error) throw new Error(error.message)
  return data.id
}

interface Semilla {
  titulo: string
  autor?: string
  tipo?: "documento" | "audio" | "video"
  estado?: "procesando" | "listo" | "fallido"
  motivo?: string
  idioma?: string
  categoria?: string
  conFicha?: boolean
  conTextos?: boolean
  costoEstimado?: number
}

/** A material the way the background task leaves it, written with the service role: nothing is processed for real. */
async function sembrar(semilla: Semilla): Promise<string> {
  const servicio = clienteDeServicio()
  const id = randomUUID()
  const estado = semilla.estado ?? "listo"
  const { error } = await servicio.from("materiales").insert({
    id,
    tipo: semilla.tipo ?? "documento",
    titulo: `${PREFIJO_DE_PRUEBA}${semilla.titulo}`,
    autor: semilla.autor ?? null,
    categoria_id: await categoria(semilla.categoria ?? "general"),
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: await idDeConi(),
    estado,
    motivo_fallo: semilla.motivo ?? null,
    idioma_original: estado === "listo" ? (semilla.idioma ?? "en") : null,
    costo_estimado_usd: semilla.costoEstimado ?? null,
  })
  if (error) throw new Error(error.message)
  if (semilla.conFicha ?? estado === "listo") {
    const ficha = await servicio.from("fichas").insert({
      material_id: id,
      resumen: "Un resumen claro de la charla sobre apego y deseo.",
      ideas_clave: IDEAS,
      citas: [
        { texto: "Amar es elegir cada día.", ubicacion: { pagina: 12 } },
        { texto: "El deseo vive de la curiosidad.", ubicacion: { segundo: 75, pista: "voz" } },
      ],
      fuente: { autor: semilla.autor ?? null, anio: 2017, enlace: "https://example.com/charla" },
    })
    if (ficha.error) throw new Error(ficha.error.message)
  }
  if (semilla.conTextos ?? estado === "listo") {
    await ponerObjetoEnElAlmacen(`materiales/${id}/texto-original.txt`, TEXTO_ORIGINAL)
  }
  return id
}

test("Coni filters the list by category, author, type and state, and the URL keeps the filters", async ({ page }) => {
  const nombreDeCategoria = `${PREFIJO_DE_PRUEBA}Apego ${Date.now()}`
  const { data: nueva, error } = await clienteDeServicio()
    .from("categorias")
    .insert({ slug: `e2e-${Date.now()}`, nombre: nombreDeCategoria })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await sembrar({ titulo: "Filtro A", autor: "Autora Filtro Uno", tipo: "audio", categoria: "general" })
  await sembrar({ titulo: "Filtro B", autor: "Autora Filtro Dos", tipo: "video", categoria: "general" })
  await sembrar({
    titulo: "Filtro C",
    autor: "Autora Filtro Uno",
    tipo: "audio",
    estado: "fallido",
    motivo: "El audio no se oye.",
    categoria: "general",
  })
  const { error: errorDeCategoria } = await clienteDeServicio()
    .from("materiales")
    .update({ categoria_id: nueva.id })
    .eq("titulo", `${PREFIJO_DE_PRUEBA}Filtro B`)
  if (errorDeCategoria) throw new Error(errorDeCategoria.message)
  const tarjeta = (nombre: string) => page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}${nombre}` })

  await page.goto("/")
  await expect(tarjeta("Filtro A")).toBeVisible()
  await expect(tarjeta("Filtro B")).toBeVisible()

  await page.getByLabel("Autor").selectOption("Autora Filtro Uno")
  await page.getByRole("button", { name: "Filtrar" }).click()
  await expect(page).toHaveURL(/autor=Autora\+Filtro\+Uno/)
  await expect(tarjeta("Filtro A")).toBeVisible()
  await expect(tarjeta("Filtro C")).toBeVisible()
  await expect(tarjeta("Filtro B")).toHaveCount(0)

  await page.getByLabel("Estado").selectOption("fallido")
  await page.getByRole("button", { name: "Filtrar" }).click()
  await expect(page).toHaveURL(/estado=fallido/)
  await expect(tarjeta("Filtro C")).toBeVisible()
  await expect(tarjeta("Filtro A")).toHaveCount(0)
  await expect(tarjeta("Filtro C").getByText("No se pudo procesar")).toBeVisible()
  await expect(tarjeta("Filtro C").getByText("El audio no se oye.")).toBeVisible()

  await page.getByRole("link", { name: "Quitar filtros" }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByLabel("Categoría").selectOption({ label: nombreDeCategoria })
  await page.getByLabel("Tipo").selectOption("video")
  await page.getByRole("button", { name: "Filtrar" }).click()
  await expect(tarjeta("Filtro B")).toBeVisible()
  await expect(tarjeta("Filtro A")).toHaveCount(0)
  await clienteDeServicio().from("materiales").delete().like("titulo", `${PREFIJO_DE_PRUEBA}Filtro%`)
  await clienteDeServicio().from("categorias").delete().eq("id", nueva.id)
})

test("Coni retries a failed material and a cap-stopped one, and each starts a run", async ({ page }) => {
  const fallido = await sembrar({
    titulo: "Reintento fallido",
    estado: "fallido",
    motivo: "El PDF no tiene texto.",
    conTextos: false,
  })
  const tope = await sembrar({
    titulo: "Reintento tope",
    estado: "procesando",
    motivo: "Llegaste al tope de gasto del mes. Súbelo en Ajustes para seguir.",
    conTextos: false,
  })
  const tarjeta = (nombre: string) => page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}${nombre}` })

  await page.goto("/")
  await expect(tarjeta("Reintento tope").getByText("Procesando", { exact: true })).toBeVisible()
  await expect(tarjeta("Reintento tope").getByText(/tope de gasto del mes/)).toBeVisible()
  await expect(tarjeta("Reintento fallido").getByText("El PDF no tiene texto.")).toBeVisible()

  await tarjeta("Reintento fallido").getByRole("button", { name: "Reintentar" }).click()
  await expect(tarjeta("Reintento fallido").getByText("Procesando", { exact: true })).toBeVisible()
  await expect(tarjeta("Reintento fallido").getByRole("button", { name: "Reintentar" })).toHaveCount(0)
  await tarjeta("Reintento tope").getByRole("button", { name: "Reintentar" }).click()
  await expect(tarjeta("Reintento tope").getByRole("button", { name: "Reintentar" })).toHaveCount(0)

  const { data } = await clienteDeServicio()
    .from("materiales")
    .select("id, estado, motivo_fallo")
    .in("id", [fallido, tope])
  expect(data).toHaveLength(2)
  for (const fila of data ?? []) expect(fila).toMatchObject({ estado: "procesando", motivo_fallo: null })
  expect(
    disparosRegistrados()
      .map((d) => d.materialId)
      .sort(),
  ).toEqual([fallido, tope].sort())
})

test("Coni confirms the cost of a long material from the list and the card, and it starts a run", async ({ page }) => {
  const motivo = "Este material es largo: procesarlo cuesta cerca de US$ 0,80. Confírmalo para seguir."
  const enLista = await sembrar({
    titulo: "Largo en lista",
    estado: "procesando",
    motivo,
    costoEstimado: 0.8,
    conTextos: false,
  })
  const enFicha = await sembrar({
    titulo: "Largo en ficha",
    estado: "procesando",
    motivo,
    costoEstimado: 1.25,
    conTextos: false,
  })
  const tarjeta = (nombre: string) => page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}${nombre}` })

  await page.goto("/")
  await expect(tarjeta("Largo en lista").getByText(motivo)).toBeVisible()
  await expect(tarjeta("Largo en lista").getByText("Espera tu OK", { exact: true })).toBeVisible()
  await expect(tarjeta("Largo en lista").getByText("Procesando", { exact: true })).toHaveCount(0)
  await expect(tarjeta("Largo en lista").getByRole("button", { name: "Reintentar" })).toHaveCount(0)
  await tarjeta("Largo en lista").getByRole("button", { name: "Procesar por ~US$ 0,80" }).click()
  await expect(tarjeta("Largo en lista").getByText("Procesando", { exact: true })).toBeVisible()
  await expect(tarjeta("Largo en lista").getByText(motivo)).toHaveCount(0)
  await expect(tarjeta("Largo en lista").getByRole("button")).toHaveCount(0)

  await page.goto(`/materiales/${enFicha}`)
  await expect(page.getByText("Espera tu OK", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Procesar por ~US$ 1,25" }).click()
  await expect(page.getByText("Procesando", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /Procesar por/ })).toHaveCount(0)
  await expect(page.getByText(motivo)).toHaveCount(0)

  const { data } = await clienteDeServicio()
    .from("materiales")
    .select("id, estado, motivo_fallo, costo_confirmado_en")
    .in("id", [enLista, enFicha])
  expect(data).toHaveLength(2)
  for (const fila of data ?? []) {
    expect(fila).toMatchObject({ estado: "procesando", motivo_fallo: null })
    expect(fila.costo_confirmado_en).not.toBeNull()
  }
  expect(
    disparosRegistrados()
      .map((d) => d.materialId)
      .sort(),
  ).toEqual([enLista, enFicha].sort())
})

test("a material that is processing makes the list ask again until it is done", async ({ page }) => {
  const id = await sembrar({ titulo: "Procesando solo", estado: "procesando", conTextos: false })
  await page.goto("/")
  const tarjeta = page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}Procesando solo` })
  await expect(tarjeta.getByText("Procesando", { exact: true })).toBeVisible()

  // The background task finishes: the list notices on its own, without a reload.
  const { error } = await clienteDeServicio().from("materiales").update({ estado: "listo" }).eq("id", id)
  if (error) throw new Error(error.message)

  await expect(tarjeta.getByText("Listo", { exact: true })).toBeVisible({ timeout: 25_000 })
})

test("Coni opens a card, edits a key idea, saves and finds it persisted; the texts download", async ({ page }) => {
  const id = await sembrar({ titulo: "Apego y deseo", autor: "Esther Perel", idioma: "en" })

  await page.goto("/")
  await capturar(page, "ingesta-materiales", CARPETA_DE_DOCUMENTACION)
  await page.getByRole("link", { name: new RegExp(`${PREFIJO_DE_PRUEBA}Apego y deseo`) }).click()
  await expect(page).toHaveURL(new RegExp(`/materiales/${id}$`))

  await expect(page.getByRole("heading", { name: `${PREFIJO_DE_PRUEBA}Apego y deseo` })).toBeVisible()
  await expect(page.getByText("Traducido del inglés y adaptado a la voz de Coni")).toBeVisible()
  await expect(page.getByText("Un resumen claro de la charla sobre apego y deseo.")).toBeVisible()
  await expect(page.getByText(IDEAS[1] ?? "")).toBeVisible()
  await expect(page.getByText("Amar es elegir cada día.")).toBeVisible()
  await expect(page.getByText("página 12")).toBeVisible()
  await expect(page.getByText("1:15")).toBeVisible()
  await expect(page.getByRole("link", { name: "https://example.com/charla" })).toBeVisible()
  await capturar(page, "ingesta-ficha", CARPETA_DE_DOCUMENTACION)

  const descargaOriginal = page.waitForEvent("download")
  await page.getByRole("link", { name: "Descargar texto original" }).click()
  const original = await descargaOriginal
  expect(original.suggestedFilename()).toBe("texto-original.txt")
  const rutaOriginal = await original.path()
  expect(readFileSync(rutaOriginal, "utf-8")).toBe(TEXTO_ORIGINAL)
  await expect(page.getByRole("link", { name: "Descargar texto completo" })).toHaveCount(0)

  await page.getByRole("button", { name: "Editar" }).click()
  await page.getByLabel("Idea clave 2", { exact: true }).fill("El deseo necesita curiosidad, no solo distancia.")
  await page.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("El deseo necesita curiosidad, no solo distancia.")).toBeVisible()
  await expect(page.getByLabel("Idea clave 2", { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText("El deseo necesita curiosidad, no solo distancia.")).toBeVisible()
  const { data } = await clienteDeServicio()
    .from("fichas")
    .select("ideas_clave, editada_por")
    .eq("material_id", id)
    .single()
  expect(data?.ideas_clave).toContain("El deseo necesita curiosidad, no solo distancia.")
  expect(data?.editada_por).toBe(await idDeConi())
})

test("a material in Spanish says it was only adapted", async ({ page }) => {
  const id = await sembrar({ titulo: "Ya en español", idioma: "es" })

  await page.goto(`/materiales/${id}`)

  await expect(page.getByText("Adaptado a la voz de Coni", { exact: true })).toBeVisible()
  await expect(page.getByText(/Traducido/)).toHaveCount(0)
})

test("Coni deletes a material after confirming in the page, and its stored files go with it", async ({ page }) => {
  const id = await sembrar({ titulo: "Para borrar" })
  const antes = await objetosDelAlmacen()
  expect(Object.keys(antes).filter((clave) => clave.includes(id))).toHaveLength(2)

  await page.goto(`/materiales/${id}`)
  await page.getByRole("button", { name: "Borrar material" }).click()
  await expect(page.getByText(/Se borran también la ficha y los archivos/)).toBeVisible()
  await page.getByRole("button", { name: "Cancelar" }).click()
  await expect(page.getByRole("button", { name: "Sí, borrar" })).toHaveCount(0)
  await page.getByRole("button", { name: "Borrar material" }).click()
  await page.getByRole("button", { name: "Sí, borrar" }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}Para borrar` })).toHaveCount(0)
  const { data } = await clienteDeServicio().from("materiales").select("id").eq("id", id)
  expect(data).toEqual([])
  const despues = await objetosDelAlmacen()
  expect(Object.keys(despues).filter((clave) => clave.includes(id))).toEqual([])
  expect(Object.keys(despues).every((clave) => clave.startsWith(`/${BALDE_DE_PRUEBA}/`))).toBe(true)
})
