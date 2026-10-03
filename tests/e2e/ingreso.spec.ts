import { expect, test } from "@playwright/test"
import { entrarComo, leerCodigo, vaciarBuzon } from "./ayudas"
import { CORREO_DE_OTRA_PERSONA, CORREO_DE_WAV } from "./entorno"

test.use({ storageState: { cookies: [], origins: [] } })

test("WAV enters with its own button and the code that reaches its address", async ({ page }) => {
  await vaciarBuzon()
  await page.goto("/ingreso")

  await page.getByRole("button", { name: "Soy WAV" }).click()
  await expect(page.getByText("w•••@estudio.test")).toBeVisible()
  const codigo = await leerCodigo(CORREO_DE_WAV)
  await page.getByRole("textbox", { name: "Número 1 de 6" }).click()
  await page.keyboard.type(codigo)

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Material de Coni" })).toBeVisible()
})

test("someone who is neither Coni nor WAV is told the app is not for them", async ({ page, context }) => {
  await entrarComo(context, CORREO_DE_OTRA_PERSONA)

  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Esta app es solo para Coni y WAV." })).toBeVisible()
  await expect(page.getByRole("link", { name: "Subir material" })).toHaveCount(0)
  await page.goto("/subir")
  await expect(page.getByRole("heading", { name: "Esta app es solo para Coni y WAV." })).toBeVisible()
})
