import { AuthError } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { correoDe, enmascararCorreo, pedirCodigo, verificarCodigo } from "@/lib/acciones/ingreso"
import { FallaDeConfiguracion } from "@/lib/dominio/falla"

const CORREO = "coni@delrosario.cl"

function authFalso(respuestas: { otp?: { error: AuthError | null }; verificar?: { error: AuthError | null } }) {
  return {
    signInWithOtp: vi.fn(async () => respuestas.otp ?? { data: {}, error: null }),
    verifyOtp: vi.fn(async () => respuestas.verificar ?? { data: {}, error: null }),
  }
}

describe("enmascararCorreo", () => {
  it("keeps the first letter and the domain", () => {
    expect(enmascararCorreo("coni@delrosario.cl")).toBe("c•••@delrosario.cl")
  })
})

describe("correoDe", () => {
  it("reads CORREO_CONI for Coni and CORREO_WAV for WAV", () => {
    const entorno = { CORREO_CONI: " coni@a.cl ", CORREO_WAV: "wav@b.cl" }
    expect(correoDe("coni", entorno)).toBe("coni@a.cl")
    expect(correoDe("wav", entorno)).toBe("wav@b.cl")
  })

  it.each(["coni", "wav"] as const)("is a configuration failure for WAV when the address of %s is missing", (rol) => {
    expect(() => correoDe(rol, {})).toThrow(FallaDeConfiguracion)
    expect(() => correoDe(rol, { CORREO_CONI: " ", CORREO_WAV: "" })).toThrow(FallaDeConfiguracion)
  })
})

describe("pedirCodigo", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("asks only for the address it was given and never creates a user", async () => {
    const auth = authFalso({})

    const resultado = await pedirCodigo({ auth, correo: CORREO })

    expect(resultado).toEqual({ ok: true })
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: CORREO, options: { shouldCreateUser: false } })
  })

  it("tells how long to wait when emails are being sent too fast", async () => {
    const auth = authFalso({
      otp: {
        error: new AuthError(
          "For security purposes, you can only request this after 45 seconds.",
          429,
          "over_email_send_rate_limit",
        ),
      },
    })

    expect(await pedirCodigo({ auth, correo: CORREO })).toEqual({
      ok: false,
      error: "Espera 45 segundos para pedir otro código.",
    })
  })

  it("keeps the technical error in the log and gives a plain message", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const auth = authFalso({ otp: { error: new AuthError("smtp exploded", 500, "unexpected_failure") } })

    const resultado = await pedirCodigo({ auth, correo: CORREO })

    expect(resultado).toEqual({ ok: false, error: "No pude mandar el código. Inténtalo de nuevo en un rato." })
    expect(registro).toHaveBeenCalled()
  })
})

describe("verificarCodigo", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("verifies a six digit code against the address", async () => {
    const auth = authFalso({})

    expect(await verificarCodigo({ auth, correo: CORREO }, " 123456 ")).toEqual({ ok: true })
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: CORREO, token: "123456", type: "email" })
  })

  it.each(["12345", "1234567", "12a456", ""])("does not even ask Supabase about %j", async (codigo) => {
    const auth = authFalso({})

    expect(await verificarCodigo({ auth, correo: CORREO }, codigo)).toEqual({
      ok: false,
      error: "El código tiene seis números.",
    })
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it("says a wrong or expired code does not work", async () => {
    const auth = authFalso({ verificar: { error: new AuthError("expired", 403, "otp_expired") } })

    expect(await verificarCodigo({ auth, correo: CORREO }, "000000")).toEqual({
      ok: false,
      error: "Ese código no sirve o ya venció. Pide otro.",
    })
  })

  it("asks to wait after too many attempts", async () => {
    const auth = authFalso({ verificar: { error: new AuthError("slow down", 429, "over_request_rate_limit") } })

    expect(await verificarCodigo({ auth, correo: CORREO }, "000000")).toEqual({
      ok: false,
      error: "Demasiados intentos. Espera un momento y pide otro código.",
    })
  })
})
