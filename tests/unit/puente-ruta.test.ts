// @vitest-environment node
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Galleta = { name: string; value: string; options: Record<string, unknown> }

const auth = vi.hoisted(() => ({ signOut: vi.fn(), verifyOtp: vi.fn() }))
const escritor = vi.hoisted(() => ({ setAll: (_galletas: Galleta[]): void => undefined }))
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _clave: string, opciones: { cookies: { setAll: (g: Galleta[]) => void } }) => {
    escritor.setAll = opciones.cookies.setAll
    return { auth }
  },
}))

const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef01234567"
const URL_DEL_PUENTE = "http://localhost:3100/ingreso/puente"
const ORIGEN_DE_CONIDOLLY = "https://conidolly.example"

function pedidoConFormulario(campos: Record<string, string>, origen: string | null = ORIGEN_DE_CONIDOLLY) {
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded" })
  if (origen !== null) headers.set("origin", origen)
  return new NextRequest(URL_DEL_PUENTE, { method: "POST", headers, body: new URLSearchParams(campos) })
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54421")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave-anonima")
  vi.stubEnv("CONIDOLLY_URL", `${ORIGEN_DE_CONIDOLLY}/inicio`)
  auth.signOut.mockResolvedValue({ error: null })
  auth.verifyOtp.mockImplementation(async () => {
    escritor.setAll([{ name: "sb-127-auth-token", value: "sesion-de-coni", options: { path: "/" } }])
    return { data: {}, error: null }
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  auth.signOut.mockReset()
  auth.verifyOtp.mockReset()
})

describe("POST /ingreso/puente", () => {
  it("writes Coni's session and opens Inicio with a 303, uncached and without a referrer", async () => {
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(pedidoConFormulario({ token_hash: TOKEN }))

    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/")
    expect(respuesta.headers.get("cache-control")).toBe("no-store")
    expect(respuesta.headers.get("referrer-policy")).toBe("no-referrer")
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: "email" })
    expect(respuesta.cookies.get("sb-127-auth-token")?.value).toBe("sesion-de-coni")
  })

  it("expires every chunk of the previous session, which the cross-site POST never showed it", async () => {
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(pedidoConFormulario({ token_hash: TOKEN }))

    for (const indice of [0, 1, 2, 3, 4]) {
      expect(respuesta.cookies.get(`sb-127-auth-token.${indice}`)).toMatchObject({ value: "", maxAge: 0, path: "/" })
    }
  })

  it("sends a refused token to the expired-link message and still clears the old session", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: "expired", status: 403, code: "otp_expired" } })
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(pedidoConFormulario({ token_hash: TOKEN }))

    expect(respuesta.headers.get("location")).toBe("/ingreso?puente=vencido")
    expect(respuesta.cookies.get("sb-127-auth-token")).toMatchObject({ value: "", maxAge: 0 })
  })

  it("answers the expired-link page instead of a 500 when Auth throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    auth.verifyOtp.mockRejectedValue(new Error("network down"))
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(pedidoConFormulario({ token_hash: TOKEN }))

    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/ingreso?puente=vencido")
  })

  it("refuses a body that is not a form without asking Supabase, and never logs the body", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(
      new NextRequest(URL_DEL_PUENTE, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGEN_DE_CONIDOLLY },
        body: JSON.stringify({ token_hash: TOKEN }),
      }),
    )

    expect(respuesta.headers.get("location")).toBe("/ingreso?puente=vencido")
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(JSON.stringify(registro.mock.calls)).not.toContain(TOKEN)
  })
})

describe("the body POST /ingreso/puente accepts", () => {
  async function esperarVencidoSinLeer(pedido: NextRequest) {
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(pedido)

    expect(respuesta.headers.get("location")).toBe("/ingreso?puente=vencido")
    expect(pedido.bodyUsed).toBe(false)
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  }

  it("refuses a body above 2 KB without reading it", async () => {
    await esperarVencidoSinLeer(
      new NextRequest(URL_DEL_PUENTE, {
        method: "POST",
        headers: {
          origin: ORIGEN_DE_CONIDOLLY,
          "content-type": "application/x-www-form-urlencoded",
          "content-length": "2049",
        },
        body: new URLSearchParams({ token_hash: TOKEN }),
      }),
    )
  })

  it.each([
    ["JSON", "application/json"],
    ["plain text", "text/plain"],
  ])("refuses %s without reading it", async (_caso, tipo) => {
    await esperarVencidoSinLeer(
      new NextRequest(URL_DEL_PUENTE, {
        method: "POST",
        headers: { origin: ORIGEN_DE_CONIDOLLY, "content-type": tipo },
        body: `token_hash=${TOKEN}`,
      }),
    )
  })

  it("takes a multipart form as well as an urlencoded one", async () => {
    const formulario = new FormData()
    formulario.set("token_hash", TOKEN)
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(
      new NextRequest(URL_DEL_PUENTE, { method: "POST", headers: { origin: ORIGEN_DE_CONIDOLLY }, body: formulario }),
    )

    expect(respuesta.headers.get("location")).toBe("/")
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: "email" })
  })
})

describe("the Origin check of POST /ingreso/puente", () => {
  async function esperarRechazo(pedido: NextRequest) {
    const { POST } = await import("@/app/ingreso/puente/route")

    const respuesta = await POST(pedido)

    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/ingreso")
    expect(respuesta.headers.get("cache-control")).toBe("no-store")
    expect(respuesta.headers.get("referrer-policy")).toBe("no-referrer")
    expect(respuesta.headers.get("set-cookie")).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  }

  it.each([
    ["no Origin", null],
    ["Origin null", "null"],
    ["another site", "https://otro.example"],
    ["Conidolly over http", "http://conidolly.example"],
  ])("ignores a POST with %s: it neither signs anyone out nor asks Auth", async (_caso, origen) => {
    await esperarRechazo(pedidoConFormulario({ token_hash: TOKEN }, origen))
  })

  it.each([
    ["unset", ""],
    ["not a URL", "conidolly.example"],
  ])("ignores every POST while CONIDOLLY_URL is %s", async (_caso, valor) => {
    vi.stubEnv("CONIDOLLY_URL", valor)
    await esperarRechazo(pedidoConFormulario({ token_hash: TOKEN }))
  })
})

describe("GET /ingreso/puente", () => {
  it("is not a way in: it goes to the sign-in page", async () => {
    const { GET } = await import("@/app/ingreso/puente/route")

    const respuesta = GET()

    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/ingreso")
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })
})
