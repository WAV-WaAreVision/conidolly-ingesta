import { conSesion } from "@/lib/acciones/servidor"
import { urlDeTexto } from "@/lib/ingesta/materiales"

/**
 * Sends the browser to a short-lived signed download of the text of a material. The person is checked here, not by
 * the page that links to it: a route handler is a public endpoint like a Server Action.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cual = new URL(request.url).searchParams.get("cual")
  const resultado = await conSesion("urlDeTexto", (deps) => urlDeTexto(deps, { materialId: id, cual }))
  if (!resultado.ok) {
    return new Response(resultado.error, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    })
  }
  return new Response(null, { status: 302, headers: { location: resultado.url, "cache-control": "no-store" } })
}
