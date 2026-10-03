// @vitest-environment node
import { HttpResponse, http } from "msw"
import { describe, expect, it } from "vitest"
import { almacenDeEntorno, almacenR2 } from "@/lib/almacen/almacen"
import { FallaDeConfiguracion } from "@/lib/dominio/falla"
import { servidor } from "../msw"

const CUENTA = "cuenta0123456789"
const LLAVE = "AKIAPRUEBADELLAVE"
const SECRETO = "secreto/de+prueba/que/no/debe/salir"
const BALDE = "material-de-coni"
const ANFITRION = `https://${CUENTA}.r2.cloudflarestorage.com`
const CLAVE = "materiales/11111111-2222-4333-8444-555555555555/original.pdf"

function r2(endpoint?: string) {
  return almacenR2({ cuenta: CUENTA, llave: LLAVE, secreto: SECRETO, balde: BALDE, endpoint })
}

describe("urlDeSubida", () => {
  it("signs a PUT URL with the content type signed, the expiry asked for and the key in the path, without calling R2", async () => {
    const llamadas: string[] = []
    servidor.use(
      http.all(`${ANFITRION}/*`, ({ request }) => {
        llamadas.push(request.url)
        return new HttpResponse(null, { status: 200 })
      }),
    )

    const url = new URL(await r2().urlDeSubida(CLAVE, 900, "application/pdf"))

    expect(url.host).toBe(`${CUENTA}.r2.cloudflarestorage.com`)
    expect(url.pathname).toBe(`/${BALDE}/${CLAVE}`)
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900")
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/)
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toContain("content-type")
    expect(url.href).not.toContain(SECRETO)
    expect(llamadas).toEqual([])
  })

  it("refuses a key outside materiales/ without calling R2", async () => {
    await expect(r2().urlDeSubida("videos/x/abc.mp4", 900, "video/mp4")).rejects.toThrow(FallaDeConfiguracion)
    await expect(r2().urlDeSubida("materiales/../x", 900, "video/mp4")).rejects.toThrow(FallaDeConfiguracion)
  })

  it.each([0, -5, 1.5, Number.NaN, 3601])("refuses an expiry of %s", async (segundos) => {
    await expect(r2().urlDeSubida(CLAVE, segundos, "application/pdf")).rejects.toThrow()
  })

  it("signs against the endpoint it is given instead of the R2 address (local runs)", async () => {
    const url = new URL(await r2("http://127.0.0.1:3101").urlDeSubida(CLAVE, 900, "application/pdf"))

    expect(url.origin).toBe("http://127.0.0.1:3101")
    expect(url.pathname).toBe(`/${BALDE}/${CLAVE}`)
  })
})

describe("tamano", () => {
  it("is the content length of the object from a HEAD", async () => {
    servidor.use(
      http.head(
        `${ANFITRION}/${BALDE}/${CLAVE}`,
        () => new HttpResponse(null, { headers: { "Content-Length": "1234" } }),
      ),
    )

    expect(await r2().tamano(CLAVE)).toBe(1234)
  })

  it("is null when the object is not there", async () => {
    servidor.use(http.head(`${ANFITRION}/${BALDE}/${CLAVE}`, () => new HttpResponse(null, { status: 404 })))

    expect(await r2().tamano(CLAVE)).toBeNull()
  })

  it("fails without the credentials in the message when R2 answers with an error", async () => {
    servidor.use(http.head(`${ANFITRION}/${BALDE}/${CLAVE}`, () => new HttpResponse(null, { status: 403 })))

    const error = await r2()
      .tamano(CLAVE)
      .then(
        () => null,
        (e: unknown) => e,
      )

    expect(error).toBeInstanceOf(Error)
    expect(String((error as Error).message)).toContain(CLAVE)
    expect(String((error as Error).message)).not.toContain(SECRETO)
  })
})

describe("almacenDeEntorno", () => {
  const ENTORNO = { R2_ACCOUNT_ID: CUENTA, R2_ACCESS_KEY_ID: LLAVE, R2_SECRET_ACCESS_KEY: SECRETO, R2_BUCKET: BALDE }

  it("asks for every R2 variable by name", () => {
    expect(() => almacenDeEntorno({ ...ENTORNO, R2_BUCKET: undefined })).toThrow("R2_BUCKET")
  })

  it("uses R2_ENDPOINT for local runs", async () => {
    const url = new URL(
      await almacenDeEntorno({ ...ENTORNO, R2_ENDPOINT: "http://127.0.0.1:3101" }).urlDeSubida(
        CLAVE,
        60,
        "application/pdf",
      ),
    )

    expect(url.origin).toBe("http://127.0.0.1:3101")
  })

  it("refuses R2_ENDPOINT on Vercel: uploads would never reach the real bucket", () => {
    expect(() => almacenDeEntorno({ ...ENTORNO, R2_ENDPOINT: "http://127.0.0.1:3101", VERCEL: "1" })).toThrow(
      FallaDeConfiguracion,
    )
  })
})

const MATERIAL = "11111111-2222-4333-8444-555555555555"
const TEXTO = `materiales/${MATERIAL}/texto.txt`

describe("urlFirmada", () => {
  it("signs a GET after checking the object is there, with the download name and the expiry asked for", async () => {
    servidor.use(
      http.head(`${ANFITRION}/${BALDE}/${TEXTO}`, () => new HttpResponse(null, { headers: { "Content-Length": "3" } })),
    )

    const url = new URL((await r2().urlFirmada(TEXTO, 300, { descargarComo: "texto.txt" })) ?? "")

    expect(url.pathname).toBe(`/${BALDE}/${TEXTO}`)
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300")
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="texto.txt"')
    expect(url.href).not.toContain(SECRETO)
  })

  it("is null, signing nothing, when the object is not there", async () => {
    servidor.use(http.head(`${ANFITRION}/${BALDE}/${TEXTO}`, () => new HttpResponse(null, { status: 404 })))

    expect(await r2().urlFirmada(TEXTO, 300)).toBeNull()
  })

  it("refuses a key that is not a text of a material, without calling R2", async () => {
    await expect(r2().urlFirmada(CLAVE, 300)).rejects.toThrow(FallaDeConfiguracion)
    await expect(r2().urlFirmada(`materiales/${MATERIAL}/../x/texto.txt`, 300)).rejects.toThrow(FallaDeConfiguracion)
  })

  it("refuses a long expiry: a download link is for right now", async () => {
    await expect(r2().urlFirmada(TEXTO, 3601)).rejects.toThrow(FallaDeConfiguracion)
  })
})

function listado(claves: string[], siguiente?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><IsTruncated>${siguiente ? "true" : "false"}</IsTruncated>${
    siguiente ? `<NextContinuationToken>${siguiente}</NextContinuationToken>` : ""
  }${claves.map((k) => `<Contents><Key>${k}</Key><Size>1</Size></Contents>`).join("")}</ListBucketResult>`
}

describe("borrarCarpeta", () => {
  it("lists the exact folder of the material, page after page, and deletes each object", async () => {
    const prefijos: (string | null)[] = []
    const borradas: string[] = []
    servidor.use(
      http.get(`${ANFITRION}/${BALDE}`, ({ request }) => {
        const url = new URL(request.url)
        prefijos.push(url.searchParams.get("prefix"))
        return HttpResponse.xml(
          url.searchParams.get("continuation-token")
            ? listado([`materiales/${MATERIAL}/texto.txt`])
            : listado([`materiales/${MATERIAL}/original.pdf`], "pagina-2"),
        )
      }),
      http.delete(`${ANFITRION}/${BALDE}/*`, ({ request }) => {
        borradas.push(decodeURIComponent(new URL(request.url).pathname.slice(`/${BALDE}/`.length)))
        return new HttpResponse(null, { status: 204 })
      }),
    )

    expect(await r2().borrarCarpeta(MATERIAL)).toBe(2)

    expect(prefijos).toEqual([`materiales/${MATERIAL}/`, `materiales/${MATERIAL}/`])
    expect(borradas.sort()).toEqual([`materiales/${MATERIAL}/original.pdf`, `materiales/${MATERIAL}/texto.txt`])
  })

  it("never deletes a key outside the folder even if the listing returned it", async () => {
    const borradas: string[] = []
    servidor.use(
      http.get(`${ANFITRION}/${BALDE}`, () =>
        HttpResponse.xml(listado([`materiales/${MATERIAL}/texto.txt`, "materiales/otro/x.txt"])),
      ),
      http.delete(`${ANFITRION}/${BALDE}/*`, ({ request }) => {
        borradas.push(decodeURIComponent(new URL(request.url).pathname.slice(`/${BALDE}/`.length)))
        return new HttpResponse(null, { status: 204 })
      }),
    )

    expect(await r2().borrarCarpeta(MATERIAL)).toBe(1)
    expect(borradas).toEqual([`materiales/${MATERIAL}/texto.txt`])
  })

  it("refuses an id that is not a UUID without calling R2", async () => {
    await expect(r2().borrarCarpeta("../materiales")).rejects.toThrow(FallaDeConfiguracion)
  })

  it("fails when R2 refuses a delete, without the credentials in the message", async () => {
    servidor.use(
      http.get(`${ANFITRION}/${BALDE}`, () => HttpResponse.xml(listado([TEXTO]))),
      http.delete(`${ANFITRION}/${BALDE}/*`, () => new HttpResponse(null, { status: 403 })),
    )

    const error = await r2()
      .borrarCarpeta(MATERIAL)
      .then(
        () => null,
        (e: unknown) => e,
      )

    expect(error).toBeInstanceOf(Error)
    expect(String((error as Error).message)).not.toContain(SECRETO)
  })
})
