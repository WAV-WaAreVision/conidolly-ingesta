import { expect, test } from "@playwright/test"

test("the text is set in Geist, one family, as in Conidolly", async ({ page }) => {
  await page.goto("/")
  const familia = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(familia).toMatch(/Geist/i)
  expect(familia).not.toMatch(/Hanken|Young/i)
})

test("the app stays on Conidolly's stone even when the phone is in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(235, 235, 234)")
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light")
})

test("the sign-in page explains a used Biblioteca link and still offers both sign-ins", async ({ browser }) => {
  const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await contexto.newPage()

  await page.goto("/ingreso?puente=vencido")

  await expect(page.getByRole("status")).toHaveText(
    "El enlace ya se usó o venció. Vuelve a Conidolly y toca Biblioteca otra vez.",
  )
  await expect(page.getByRole("button", { name: "Soy Coni" })).toBeVisible()
  await contexto.close()
})
