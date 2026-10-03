import { describe, expect, it } from "vitest"
import { semanaDe } from "@/lib/ingesta/semana-de"

describe("semanaDe", () => {
  it("is the same day when the date is a Sunday in Santiago", () => {
    expect(semanaDe(new Date("2026-10-05T00:00:00Z"))).toBe("2026-10-04")
  })

  it("is the coming Sunday when the date is a Wednesday", () => {
    expect(semanaDe(new Date("2026-10-07T15:00:00Z"))).toBe("2026-10-11")
  })

  it("is the next day on a Saturday night in Santiago, even when UTC is already Sunday", () => {
    expect(semanaDe(new Date("2026-10-04T02:30:00Z"))).toBe("2026-10-04")
  })

  it("stays on that Sunday on a Sunday night in Santiago, even when UTC is already Monday", () => {
    expect(semanaDe(new Date("2026-10-05T01:00:00Z"))).toBe("2026-10-04")
  })

  it("moves to the next week on Monday morning in Santiago", () => {
    expect(semanaDe(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-11")
  })

  it("crosses a month and a year boundary", () => {
    expect(semanaDe(new Date("2026-12-30T15:00:00Z"))).toBe("2027-01-03")
  })
})
