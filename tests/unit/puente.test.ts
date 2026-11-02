import { AuthError } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  claveDeSesion,
  cruzarPuente,
  DESTINO_DEL_PUENTE_VENCIDO,
  galletasDeLaSesionAnterior,
  origenDeConidolly,
  TEXTO_PUENTE_VENCIDO,
} from "@/lib/sesion/puente"

const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef01234567"

function authFalso(verificar: { error: AuthError | null } = { error: null }) {
  const llamadas: string[] = []
  return {
    llamadas,
    signOut: vi.fn(async () => {
      llamadas.push("signOut")
      return { error: null }
    }),
    verifyOtp: vi.fn(async () => {
      llamadas.push("verifyOtp")
      return verificar
    }),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("cruzarPuente", () => {
  it("signs the old session out first, then verifies the token as an email token hash, and opens Inicio", async () => {
    const auth = authFalso()

    expect(await cruzarPuente(auth, TOKEN)).toBe("/")
    expect(auth.llamadas).toEqual(["signOut", "verifyOtp"])
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: "email" })
  })

  it.each([
    ["nothing", null],
    ["an empty value", "   "],
    ["a value longer than 512 characters", "a".repeat(513)],
    ["a file instead of text", new Blob(["x"])],
  ])("sends %s to the expired-link message without asking Supabase", async (_caso, token) => {
    const auth = authFalso()

    expect(await cruzarPuente(auth, token)).toBe(DESTINO_DEL_PUENTE_VENCIDO)
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it("sends a used or expired token to the message, quietly: that is a normal case", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const auth = authFalso({ error: new AuthError("Email link is invalid or has expired", 403, "otp_expired") })

    expect(await cruzarPuente(auth, TOKEN)).toBe("/ingreso?puente=vencido")
    expect(registro).not.toHaveBeenCalled()
  })

  it("logs an unexpected Auth failure with status and code, never the token", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const auth = authFalso({ error: new AuthError("upstream exploded", 500, "unexpected_failure") })

    expect(await cruzarPuente(auth, TOKEN)).toBe(DESTINO_DEL_PUENTE_VENCIDO)
    expect(registro).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(registro.mock.calls)).not.toContain(TOKEN)
  })

  it("says what to do in plain Spanish", () => {
    expect(TEXTO_PUENTE_VENCIDO).toBe("El enlace ya se usó o venció. Vuelve a Conidolly y toca Biblioteca otra vez.")
  })
})

describe("the session cookie of the previous person", () => {
  it("is named after the first label of the Supabase host, as supabase-js names it", () => {
    expect(claveDeSesion("http://127.0.0.1:54421")).toBe("sb-127-auth-token")
    expect(claveDeSesion("https://mvfytttfxmzzjajecsch.supabase.co")).toBe("sb-mvfytttfxmzzjajecsch-auth-token")
  })

  it("is expired whole: the cookie and the five chunks @supabase/ssr may have split it into", () => {
    expect(galletasDeLaSesionAnterior("sb-127-auth-token")).toEqual([
      "sb-127-auth-token",
      "sb-127-auth-token.0",
      "sb-127-auth-token.1",
      "sb-127-auth-token.2",
      "sb-127-auth-token.3",
      "sb-127-auth-token.4",
    ])
  })
})

describe("origenDeConidolly", () => {
  it("keeps only the origin of an https URL", () => {
    expect(origenDeConidolly("https://conidolly.vercel.app/inicio?x=1", "production")).toBe(
      "https://conidolly.vercel.app",
    )
  })

  it("accepts http outside production only, for the local apps", () => {
    expect(origenDeConidolly("http://127.0.0.1:3200", "development")).toBe("http://127.0.0.1:3200")
    expect(origenDeConidolly("http://127.0.0.1:3200", "production")).toBeNull()
  })

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["without a scheme", "conidolly.vercel.app"],
    ["another scheme", "javascript:alert(1)"],
  ])("refuses a value that is %s", (_caso, valor) => {
    expect(origenDeConidolly(valor, "development")).toBeNull()
  })
})
