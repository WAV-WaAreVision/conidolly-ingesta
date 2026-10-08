const ANFITRIONES_DE_YOUTUBE = ["youtube.com", "youtu.be", "youtube-nocookie.com"]

export const PASOS_DE_YOUTUBE =
  "YouTube no deja leer lo que se dice en el video. Ábrelo, toca «…más» y luego «Mostrar transcripción», cópiala y pégala aquí."

/** Whether a link points to YouTube (any subdomain); third-party video is never fetched, so its transcript is pasted. */
export function esYoutube(direccion: string): boolean {
  let anfitrion: string
  try {
    anfitrion = new URL(direccion.trim()).hostname.toLowerCase()
  } catch {
    // Not an address yet (the person is still typing): it is not YouTube, and the form reports the address itself.
    return false
  }
  return ANFITRIONES_DE_YOUTUBE.some((dominio) => anfitrion === dominio || anfitrion.endsWith(`.${dominio}`))
}
