import { expect, test } from "@playwright/test"
import { semanaDe } from "../../lib/ingesta/semana-de"
import { capturar, clienteDeServicio, disparosDelMotor, limpiarDisparos, sembrarTema } from "./ayudas"
import { CARPETA_DE_DOCUMENTACION, PREFIJO_DE_PRUEBA } from "./entorno"

const ESTA_SEMANA = semanaDe(new Date())

async function limpiarSemana() {
  const servicio = clienteDeServicio()
  const teorias = await servicio.from("teorias").delete().eq("origen", "motor").eq("semana", ESTA_SEMANA)
  if (teorias.error) throw new Error(teorias.error.message)
  const corridas = await servicio.from("motor_corridas").delete().eq("semana", ESTA_SEMANA)
  if (corridas.error) throw new Error(corridas.error.message)
}

test.beforeEach(async () => {
  limpiarDisparos()
  await limpiarSemana()
})

test.afterAll(limpiarSemana)

test("Coni sees an empty Semana before the first run and asks the engine for this week", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Semana" }).click()
  await expect(page).toHaveURL(/\/semana$/)
  await expect(
    page.getByText("Todavía no corre el motor. La primera tanda llega el domingo a las 20:00."),
  ).toBeVisible()

  await page.getByRole("button", { name: "Proponer ahora" }).click()

  await expect(page.getByRole("status")).toContainText("El motor se puso a trabajar")
  expect(disparosDelMotor()).toEqual([{ tarea: "motor-manual", semana: ESTA_SEMANA }])
})

test("Coni reads the latest run, its theories, the discarded crossings and what to upload, and is told the engine already ran", async ({
  page,
}) => {
  const servicio = clienteDeServicio()
  const [apego, deseo, celos] = await Promise.all([sembrarTema("Apego"), sembrarTema("Deseo"), sembrarTema("Celos")])
  const corrida = await servicio.from("motor_corridas").insert({
    semana: ESTA_SEMANA,
    estado: "lista",
    costo_usd: 1.2345,
    resumen: { ideas: 9, manual: false, queSubir: { unSoloAutor: ["Celos"], pilaresSinMaterial: ["general"] } },
  })
  if (corrida.error) throw new Error(corrida.error.message)
  const teorias = await servicio.from("teorias").insert([
    {
      origen: "motor",
      semana: ESTA_SEMANA,
      estado: "guardada",
      titulo: `${PREFIJO_DE_PRUEBA}El apego explica el deseo`,
      tesis: "Quien se siente seguro desea más.",
      temas: [apego, deseo],
      puntaje: 0.82,
      nivel_evidencia: "alto",
    },
    {
      origen: "motor",
      semana: ESTA_SEMANA,
      estado: "descartada_por_motor",
      motivo_fallo: "Los autores no se refieren a lo mismo",
      temas: [deseo, celos],
      puntaje: 0.4,
    },
  ])
  if (teorias.error) throw new Error(teorias.error.message)

  await page.goto("/semana")

  const resumen = page.getByRole("region", { name: "Última corrida" })
  await expect(resumen.getByText("Lista")).toBeVisible()
  await expect(resumen.getByText("9 ideas")).toBeVisible()
  await expect(resumen.getByText("US$ 1,23")).toBeVisible()
  const teoria = page.getByRole("listitem", { name: `${PREFIJO_DE_PRUEBA}El apego explica el deseo` })
  await expect(teoria.getByText("Quien se siente seguro desea más.")).toBeVisible()
  await expect(teoria.getByText("Puntaje 0,82")).toBeVisible()
  await expect(teoria.getByText("Evidencia alta")).toBeVisible()
  await expect(page.getByRole("region", { name: "Cruces descartados" })).toContainText(
    "Los autores no se refieren a lo mismo",
  )
  const subir = page.getByRole("region", { name: "Qué subir después" })
  await expect(subir.getByText("Celos")).toBeVisible()
  await expect(subir.getByText("General")).toBeVisible()
  await capturar(page, "ingesta-semana", CARPETA_DE_DOCUMENTACION)

  await page.getByRole("button", { name: "Proponer ahora" }).click()
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "El motor ya propuso ideas esta semana. Puedes pedir otras desde el lunes." }),
  ).toBeVisible()
  expect(disparosDelMotor()).toEqual([])

  await teoria.getByRole("link", { name: new RegExp(`^${PREFIJO_DE_PRUEBA}Apego`) }).click()
  await expect(page).toHaveURL(new RegExp(`/temas/${apego}$`))
})
