import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ActualizarMientras } from "@/components/actualizar-mientras"

const refrescar = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refrescar }) }))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  refrescar.mockClear()
})

describe("ActualizarMientras", () => {
  it("refreshes the page every 10 seconds while active", () => {
    render(<ActualizarMientras activo />)

    vi.advanceTimersByTime(9_999)
    expect(refrescar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refrescar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(20_000)
    expect(refrescar).toHaveBeenCalledTimes(3)
  })

  it("never refreshes when nothing is processing", () => {
    render(<ActualizarMientras activo={false} />)

    vi.advanceTimersByTime(60_000)
    expect(refrescar).not.toHaveBeenCalled()
  })

  it("stops once the page says nothing is processing any more", () => {
    const { rerender } = render(<ActualizarMientras activo />)
    vi.advanceTimersByTime(10_000)
    expect(refrescar).toHaveBeenCalledTimes(1)

    rerender(<ActualizarMientras activo={false} />)
    vi.advanceTimersByTime(60_000)

    expect(refrescar).toHaveBeenCalledTimes(1)
  })
})
