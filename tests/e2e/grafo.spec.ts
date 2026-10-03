import { expect, test } from "@playwright/test"
import { capturar, clienteDeServicio, idDeConi, sembrarMaterial } from "./ayudas"
import { dato, lugarDe, type Punto } from "./ayudas-del-grafo"
import { CARPETA_DE_DOCUMENTACION, PREFIJO_DE_PRUEBA } from "./entorno"

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

test("the back link goes to the list of materials", async ({ page }) => {
  await page.goto("/grafo")
  await page.getByRole("link", { name: "Volver a materiales" }).click()
  await expect(page).toHaveURL(/\/$/)
})

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
  await page.getByTestId("grafo").scrollIntoViewIfNeeded()
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

for (const modo of ["mouse", "touch"] as const) {
  test(`Coni uses the graph with real ${modo} input: card, edge decision and a link by hand`, async ({ page }) => {
    const apego = await sembrarMaterial(`Toque ${modo} apego`, "Autora Toque")
    const deseo = await sembrarMaterial(`Toque ${modo} deseo`, "Autora Toque")
    const limites = await sembrarMaterial(`Toque ${modo} límites`, "Autora Toque")
    await sembrarVinculo(apego, deseo, { estado: "sugerido", razon: "Los dos hablan de la distancia.", relevancia: 4 })
    const idArista = [apego, deseo].sort().join("|")
    const cdp = await page.context().newCDPSession(page)

    async function tocar(punto: Punto) {
      if (modo === "mouse") {
        await page.mouse.move(punto.x, punto.y)
        await page.mouse.click(punto.x, punto.y, { delay: 60 })
      } else await page.touchscreen.tap(punto.x, punto.y)
    }
    async function mantener(punto: Punto) {
      if (modo === "mouse") {
        await page.mouse.move(punto.x, punto.y)
        await page.mouse.down()
        await page.waitForTimeout(800)
        await page.mouse.up()
        return
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [punto] })
      await page.waitForTimeout(800)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    }

    await page.goto("/grafo")
    await expect(page.getByTestId("grafo").locator("canvas").first()).toBeVisible()

    await tocar(await lugarDe(page, "nodo", apego))
    const ficha = page.getByRole("dialog", { name: `${PREFIJO_DE_PRUEBA}Toque ${modo} apego` })
    await expect(ficha).toBeVisible()
    await expect(ficha.getByRole("link", { name: "Ver ficha" })).toHaveAttribute("href", `/materiales/${apego}`)
    await ficha.getByRole("button", { name: "Cerrar" }).click()
    await expect(ficha).toHaveCount(0)

    await tocar(await lugarDe(page, "arista", idArista))
    const vinculo = page.getByRole("dialog", { name: "Vínculo" })
    await expect(vinculo.getByText("Los dos hablan de la distancia.")).toBeVisible()
    await expect(vinculo.getByText(/Cita del primero/)).toBeVisible()
    await expect(vinculo.getByText(/Cita del segundo/)).toBeVisible()
    await vinculo.getByRole("button", { name: "Aceptar" }).click()
    await expect(vinculo).toHaveCount(0)
    await expect.poll(() => dato(page, idArista, "dashed")).toBe(false)
    await expect.poll(() => dato(page, idArista, "estado")).toBe("aceptado")

    await mantener(await lugarDe(page, "nodo", apego))
    await expect(page.getByText(/Toca otro material para unirlo con/)).toBeVisible()
    await tocar(await lugarDe(page, "nodo", limites))
    const nuevo = page.getByRole("dialog", { name: "Vincular a mano" })
    await expect(nuevo).toBeVisible()
    await nuevo.getByLabel("Tipo de vínculo").selectOption("contradice")
    await nuevo.getByRole("button", { name: "Crear vínculo" }).click()
    await expect(nuevo).toHaveCount(0)
    const idNueva = [apego, limites].sort().join("|")
    await expect.poll(() => dato(page, idNueva, "estado")).toBe("aceptado")
    await expect.poll(() => dato(page, idNueva, "dashed")).toBe(false)
    await expect.poll(() => dato(page, idNueva, "tipo")).toBe("contradice")

    await clienteDeServicio().from("materiales").delete().in("id", [apego, deseo, limites])
  })
}
