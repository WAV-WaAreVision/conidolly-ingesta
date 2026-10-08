import { describe, expect, it } from "vitest"
import { esYoutube, PASOS_DE_YOUTUBE } from "@/lib/ingesta/youtube"

describe("esYoutube", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc123",
    "https://youtube.com/watch?v=abc123",
    "https://m.youtube.com/watch?v=abc123",
    "https://music.youtube.com/watch?v=abc123",
    "https://youtu.be/abc123",
    "https://www.youtube-nocookie.com/embed/abc123",
    "HTTPS://WWW.YOUTUBE.COM/watch?v=abc123",
    "  https://youtu.be/abc123  ",
  ])("recognizes %s", (url) => {
    expect(esYoutube(url)).toBe(true)
  })

  it.each([
    "https://notyoutube.com/nota",
    "https://youtube.com.evil.cl/nota",
    "https://ejemplo.cl/?u=https://youtu.be/abc",
    "https://example.com/nota",
    "youtube.com/watch?v=abc123",
    "no es un link",
    "",
  ])("does not treat %s as YouTube", (url) => {
    expect(esYoutube(url)).toBe(false)
  })

  it("explains how to copy the transcript", () => {
    expect(PASOS_DE_YOUTUBE).toContain("Mostrar transcripción")
  })
})
