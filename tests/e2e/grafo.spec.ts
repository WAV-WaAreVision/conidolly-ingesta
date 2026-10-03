import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { capturar, clienteDeServicio } from "./ayudas"
import { CARPETA_DE_DOCUMENTACION, CORREO_DE_CONI, PREFIJO_DE_PRUEBA } from "./entorno"

async function idDeConi(): Promise<string> {
  const { data, error } = await clienteDeServicio().auth.admin.listUsers()
  const id = data?.users.find((usuario) => usuario.email === CORREO_DE_CONI)?.id
  if (error || !id) throw new Error(`No encontré a ${CORREO_DE_CONI} en el Auth local.`)
  return id
}

/** A ready material with its card, written with the service role: nothing is processed for real. */
async function sembrarMaterial(titulo: string, autor: string): Promise<string> {
  const servicio = clienteDeServicio()
  const id = randomUUID()
  const categoria = await servicio.from("categorias").select("id").eq("slug", "general").single()
  if (categoria.error) throw new Error(categoria.error.message)
  const material = await servicio.from("materiales").insert({
    id,
    tipo: "documento",
    titulo: `${PREFIJO_DE_PRUEBA}${titulo}`,
    autor,
    categoria_id: categoria.data.id,
    texto_pegado: "x",
    declaracion_sin_pacientes_en: new Date().toISOString(),
    subido_por: await idDeConi(),
    estado: "listo",
    idioma_original: "es",
  })
  if (material.error) throw new Error(material.error.message)
  const ficha = await servicio.from("fichas").insert({
    material_id: id,
    resumen: "Un resumen de prueba.",
    ideas_clave: ["uno", "dos", "tres", "cuatro", "cinco"],
    citas: [{ texto: "Una cita de prueba.", ubicacion: { pagina: 3 } }],
    fuente: { autor, anio: 2020, enlace: null },
  })
  if (ficha.error) throw new Error(ficha.error.message)
  return id
}

async function sembrarVinculo(x: string, y: string, extra: { estado: string; razon: string; relevancia: number }) {
  const [a, b] = [x, y].sort() as [string, string]
  const { error } = await clienteDeServicio()
    .from("vinculos")
    .insert({
      material_a: a,
      material_b: b,
      tipo: "complementa",
      cita_a: "Cita del primero",
      cita_b: "Cita del segundo",
      ...extra,
    })
  if (error) throw new Error(error.message)
}

test("Coni sees the suggested links, accepts one and it reads as accepted; the graph draws", async ({ page }) => {
  const apego = await sembrarMaterial("Grafo apego", "Autora Grafo")
  const deseo = await sembrarMaterial("Grafo deseo", "Autora Grafo")
  const limites = await sembrarMaterial("Grafo límites", "Otro Autor")
  await sembrarVinculo(apego, deseo, { estado: "sugerido", razon: "Los dos hablan de la distancia.", relevancia: 4 })
  await sembrarVinculo(deseo, limites, { estado: "aceptado", razon: "Uno amplía al otro.", relevancia: 2 })
  const fila = (nombre: string) => page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}${nombre}` })

  await page.goto("/")
  await page.getByRole("link", { name: "Ver vínculos" }).click()
  await expect(page).toHaveURL(/\/grafo$/)
  await expect(page.getByRole("heading", { name: "Vínculos entre materiales" })).toBeVisible()

  await expect(page.getByTestId("grafo").locator("canvas").first()).toBeVisible()
  await page.waitForTimeout(800)
  await capturar(page, "ingesta-grafo", CARPETA_DE_DOCUMENTACION)

  await page.getByRole("button", { name: "Ver como lista" }).click()
  const sugerido = fila("Grafo apego")
  await expect(sugerido).toBeVisible()
  await expect(sugerido.getByText("Sugerido", { exact: true })).toBeVisible()
  await expect(sugerido.getByText("Los dos hablan de la distancia.")).toBeVisible()
  await expect(fila("Grafo límites").getByText("Aceptado", { exact: true })).toBeVisible()
  await expect(fila("Grafo límites").getByRole("button", { name: "Aceptar" })).toHaveCount(0)

  await sugerido.getByRole("button", { name: "Aceptar" }).click()
  await expect(sugerido.getByText("Aceptado", { exact: true })).toBeVisible()
  await expect(sugerido.getByRole("button", { name: "Aceptar" })).toHaveCount(0)

  const { data } = await clienteDeServicio()
    .from("vinculos")
    .select("estado, decidido_por")
    .eq("material_a", [apego, deseo].sort()[0] ?? "")
    .eq("material_b", [apego, deseo].sort()[1] ?? "")
    .single()
  expect(data).toMatchObject({ estado: "aceptado", decidido_por: await idDeConi() })

  await sugerido.getByLabel("Relevancia").selectOption("5")
  await expect(sugerido.getByLabel("Relevancia")).toHaveValue("5")
  await fila("Grafo límites").getByRole("button", { name: "Descartar" }).click()
  await expect(fila("Grafo límites")).toHaveCount(0)
})
