// The R2 of the E2E run: a tiny S3 on this machine that accepts the presigned PUT of the browser and answers the HEAD
// of the server, so the app signs and measures with its real code and nothing real is reachable. It keeps only the
// size and content type of each object. GET /__objetos lists them.
import { createServer } from "node:http"

const PUERTO = Number(process.env.PUERTO_ALMACEN_FALSO ?? 3101)
const objetos = new Map<string, { bytes: number; tipo: string; firmada: boolean }>()

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "PUT, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-expose-headers": "etag",
}

const servidor = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const clave = decodeURIComponent(url.pathname)

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS)
    res.end()
    return
  }
  if (url.pathname === "/__salud") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end('{"ok":true}')
    return
  }
  if (url.pathname === "/__objetos") {
    res.writeHead(200, { "content-type": "application/json", ...CORS })
    res.end(JSON.stringify(Object.fromEntries(objetos)))
    return
  }
  if (req.method === "PUT") {
    let bytes = 0
    req.on("data", (trozo: Buffer) => {
      bytes += trozo.byteLength
    })
    req.on("end", () => {
      objetos.set(clave, {
        bytes,
        tipo: req.headers["content-type"] ?? "",
        firmada: url.searchParams.has("X-Amz-Signature"),
      })
      res.writeHead(200, { ...CORS, etag: '"falso"' })
      res.end()
    })
    return
  }
  if (req.method === "HEAD") {
    const objeto = objetos.get(clave)
    res.writeHead(objeto ? 200 : 404, objeto ? { ...CORS, "content-length": String(objeto.bytes) } : CORS)
    res.end()
    return
  }
  res.writeHead(405, CORS)
  res.end()
})

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`almacén falso en http://127.0.0.1:${PUERTO}`)
})
