import { describe, expect, it } from "vitest"
import { esperaConfirmacion, estadoVisible, estaProcesando, sePuedeReintentar } from "@/app/(app)/estado-de-material"

const esperando = {
  estado: "procesando",
  motivo_fallo: "Este material es largo",
  costo_estimado_usd: 0.8,
  costo_confirmado_en: null,
}

describe("estado de un material que espera confirmación", () => {
  it("is waiting only while procesando with an estimate nobody confirmed", () => {
    expect(esperaConfirmacion(esperando)).toBe(true)
    expect(esperaConfirmacion({ ...esperando, costo_confirmado_en: "2026-10-03T12:00:00Z" })).toBe(false)
    expect(esperaConfirmacion({ ...esperando, costo_estimado_usd: null })).toBe(false)
    expect(esperaConfirmacion({ ...esperando, estado: "listo" })).toBe(false)
  })

  it("is not retryable and does not poll while it waits", () => {
    expect(sePuedeReintentar(esperando)).toBe(false)
    expect(estaProcesando(esperando)).toBe(false)
  })

  it("polls again once confirmed, because the reason is cleared", () => {
    expect(estaProcesando({ ...esperando, motivo_fallo: null, costo_confirmado_en: "2026-10-03T12:00:00Z" })).toBe(true)
  })
})

describe("chip de estado de un material", () => {
  it("says Espera tu OK with a neutral token while the cost waits for confirmation", () => {
    expect(estadoVisible(esperando)).toEqual({ texto: "Espera tu OK", clases: "bg-hundido text-apagado" })
  })

  it("keeps Procesando for a material that is really processing, even with a confirmed cost", () => {
    const confirmado = { ...esperando, motivo_fallo: null, costo_confirmado_en: "2026-10-03T12:00:00Z" }
    expect(estadoVisible(confirmado).texto).toBe("Procesando")
  })

  it("keeps the usual chip for listo, fallido and unknown states", () => {
    expect(estadoVisible({ ...esperando, estado: "listo" }).texto).toBe("Listo")
    expect(estadoVisible({ ...esperando, estado: "fallido" }).texto).toBe("No se pudo procesar")
    expect(estadoVisible({ ...esperando, estado: "raro" }).texto).toBe("raro")
  })
})
