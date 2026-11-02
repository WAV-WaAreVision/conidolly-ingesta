import { describe, expect, it } from "vitest"
import { decidirRuta } from "@/lib/sesion/rutas"

describe("decidirRuta", () => {
  it("sends a visitor without a session to sign in, except on the sign-in page", () => {
    expect(decidirRuta({ ruta: "/", haySesion: false })).toBe("a_ingreso")
    expect(decidirRuta({ ruta: "/subir", haySesion: false })).toBe("a_ingreso")
    expect(decidirRuta({ ruta: "/ingreso", haySesion: false })).toBe("seguir")
  })

  it("sends someone with a session away from the sign-in page", () => {
    expect(decidirRuta({ ruta: "/ingreso", haySesion: true })).toBe("a_inicio")
    expect(decidirRuta({ ruta: "/subir", haySesion: true })).toBe("seguir")
  })

  it("lets the bridge from Conidolly through with or without a session, so it can swap the session", () => {
    expect(decidirRuta({ ruta: "/ingreso/puente", haySesion: false })).toBe("seguir")
    expect(decidirRuta({ ruta: "/ingreso/puente", haySesion: true })).toBe("seguir")
    // Only the bridge: the rest of /ingreso still sends someone with a session to Inicio.
    expect(decidirRuta({ ruta: "/ingreso/otra", haySesion: true })).toBe("a_inicio")
  })
})
