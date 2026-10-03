import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { capturar, clienteDeServicio, disparosDeTeoria, idDeConi, limpiarDisparos, sembrarMaterial } from "./ayudas"
import { dato, lugarDe, tieneClase } from "./ayudas-del-grafo"
import { CARPETA_DE_DOCUMENTACION, PREFIJO_DE_PRUEBA } from "./entorno"

test.beforeEach(() => limpiarDisparos())

/** What the Trigger.dev task writes when it finishes, written here with the service role: nothing is synthesized. */
async function simularLaSintesis(teoriaId: string, fuentes: [string, string]) {
  const { error } = await clienteDeServicio()
    .from("teorias")
    .update({
      titulo: `${PREFIJO_DE_PRUEBA}El deseo se conversa`,
      tesis: "El deseo cambia con el tiempo y hablarlo con calma cuida a la pareja.",
      argumentos: [
        {
          materialId: fuentes[0],
          aporte: "Dice que el deseo cambia.",
          cita: "Una cita de prueba.",
          ubicacion: "cita 1",
        },
        {
          materialId: fuentes[1],
          aporte: "Dice que conversar cuida.",
          cita: "Una cita de prueba.",
          ubicacion: "cita 1",
        },
      ],
      contradicciones: [{ materialIds: fuentes, descripcion: "Chocan en el ritmo del deseo." }],
      estado: "borrador",
    })
    .eq("id", teoriaId)
  if (error) throw new Error(error.message)
}

test("Coni picks two materials on the graph, waits for the synthesis, edits the title, saves it and sees it on the graph", async ({
  page,
}) => {
  const deseo = await sembrarMaterial("Teoría deseo", "Autora Teoría")
  const pareja = await sembrarMaterial("Teoría pareja", "Autora Teoría")
  let teoriaId = ""
  try {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Ver teorías" })).toBeVisible()
    await page.getByRole("link", { name: "Ver vínculos" }).click()
    await expect(page.getByTestId("grafo").locator("canvas").first()).toBeVisible()

    await page.getByRole("button", { name: "Seleccionar" }).click()
    await expect(page.getByText("Elige al menos 2 materiales (llevas 0).")).toBeVisible()
    for (const id of [deseo, pareja]) {
      const punto = await lugarDe(page, "nodo", id)
      await page.mouse.move(punto.x, punto.y)
      await page.mouse.click(punto.x, punto.y, { delay: 60 })
    }
    await expect(page.getByText("2 materiales elegidos.")).toBeVisible()
    await expect.poll(() => tieneClase(page, deseo, "elegido")).toBe(true)
    await expect.poll(() => tieneClase(page, pareja, "elegido")).toBe(true)

    await page.getByRole("button", { name: "Sintetizar" }).click()
    await expect(page).toHaveURL(/\/teorias\/[0-9a-f-]{36}$/)
    teoriaId = page.url().split("/").at(-1) ?? ""
    await expect(page.getByText(/Estoy armando la teoría con tus 2 materiales/)).toBeVisible()
    expect(disparosDeTeoria()).toEqual([{ tarea: "sintetizar-teoria", teoriaId }])
    const fuentes = await clienteDeServicio().from("teoria_fuentes").select("material_id").eq("teoria_id", teoriaId)
    expect(fuentes.data?.map((f) => f.material_id).sort()).toEqual([deseo, pareja].sort())
    expect(await clienteDeServicio().from("teorias").select("creada_por").eq("id", teoriaId).single()).toMatchObject({
      data: { creada_por: await idDeConi() },
    })

    await simularLaSintesis(teoriaId, [deseo, pareja])
    // The page asks again by itself every five seconds while the theory is being written.
    await expect(page.getByLabel("Título")).toHaveValue(`${PREFIJO_DE_PRUEBA}El deseo se conversa`, { timeout: 20_000 })
    await expect(page.getByText("Chocan en el ritmo del deseo.")).toBeVisible()
    await expect(page.getByText("Dice que conversar cuida.")).toBeVisible()
    await expect(page.getByRole("link", { name: `${PREFIJO_DE_PRUEBA}Teoría deseo` }).first()).toBeVisible()
    await capturar(page, "ingesta-teoria", CARPETA_DE_DOCUMENTACION)

    await page.getByLabel("Título").fill(`${PREFIJO_DE_PRUEBA}Hablar el deseo`)
    await page.getByRole("button", { name: "Guardar" }).click()
    await expect(page.getByText("Teoría guardada.")).toBeVisible()
    const guardada = await clienteDeServicio()
      .from("teorias")
      .select("estado, titulo, editada_en")
      .eq("id", teoriaId)
      .single()
    expect(guardada.data).toMatchObject({ estado: "guardada", titulo: `${PREFIJO_DE_PRUEBA}Hablar el deseo` })

    await page.goto("/teorias")
    const tarjeta = page.getByRole("listitem").filter({ hasText: `${PREFIJO_DE_PRUEBA}Hablar el deseo` })
    await expect(tarjeta.getByText("Guardada")).toBeVisible()
    await expect(tarjeta.getByText("2 fuentes")).toBeVisible()

    await page.goto("/grafo")
    await expect(page.getByTestId("grafo").locator("canvas").first()).toBeVisible()
    await lugarDe(page, "nodo", teoriaId)
    await expect.poll(() => dato(page, teoriaId, "tipoDeNodo")).toBe("teoria")
    await expect.poll(() => dato(page, teoriaId, "shape")).toBe("diamond")
    await expect.poll(() => dato(page, `${teoriaId}|${deseo}`, "tipoDeArista")).toBe("teoria")
    await expect.poll(() => dato(page, `${teoriaId}|${pareja}`, "tipoDeArista")).toBe("teoria")
  } finally {
    if (teoriaId) await clienteDeServicio().from("teorias").delete().eq("id", teoriaId)
    await clienteDeServicio().from("materiales").delete().in("id", [deseo, pareja])
  }
})

test("a theory that failed says why and Reintentar starts it again", async ({ page }) => {
  const a = await sembrarMaterial("Teoría fallida uno", "Autora Teoría")
  const b = await sembrarMaterial("Teoría fallida dos", "Autora Teoría")
  const teoriaId = randomUUID()
  try {
    const servicio = clienteDeServicio()
    const creada = await servicio
      .from("teorias")
      .insert({ id: teoriaId, estado: "fallida", motivo_fallo: "No encontré suficiente apoyo en las fichas." })
    if (creada.error) throw new Error(creada.error.message)
    const fuentes = await servicio
      .from("teoria_fuentes")
      .insert([a, b].map((material_id) => ({ teoria_id: teoriaId, material_id })))
    if (fuentes.error) throw new Error(fuentes.error.message)

    await page.goto(`/teorias/${teoriaId}`)
    await expect(page.getByRole("alert").filter({ hasText: "No encontré suficiente apoyo" })).toBeVisible()
    await page.getByRole("button", { name: "Reintentar" }).click()
    await expect(page.getByText(/Estoy armando la teoría/)).toBeVisible()

    const [disparo] = disparosDeTeoria()
    expect(disparo).toMatchObject({ tarea: "sintetizar-teoria", teoriaId })
    expect(disparo?.intento).toBeTruthy()
    const { data } = await servicio.from("teorias").select("estado, motivo_fallo").eq("id", teoriaId).single()
    expect(data).toEqual({ estado: "sintetizando", motivo_fallo: null })
  } finally {
    await clienteDeServicio().from("teorias").delete().eq("id", teoriaId)
    await clienteDeServicio().from("materiales").delete().in("id", [a, b])
  }
})
