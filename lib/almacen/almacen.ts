import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { FallaDeConfiguracion } from "@/lib/dominio/falla"
import { exigirEnv } from "@/lib/env"

// The minimum of `lib/proveedores/almacen.ts` of estudio-coni that this app needs: the key of a material, a presigned
// PUT, the size of what arrived, a presigned GET of its text and the deletion of its folder. The repos do not import
// each other: keep `claveMaterial` identical in both.

/** Private object storage: Cloudflare R2 in production, memory in tests. */
export interface Almacen {
  /** A presigned PUT for a material: the browser uploads straight to the store, and `tipo` is signed into the URL. */
  urlDeSubida(clave: string, segundos: number, tipo: string): Promise<string>
  /** The size in bytes of the object, `null` when it is not there; any other failure rejects. */
  tamano(clave: string): Promise<number | null>
  /** A presigned GET of a text of a material that downloads as `descargarComo`; null when the object is not there. */
  urlFirmada(clave: string, segundos: number, opciones?: { descargarComo?: string }): Promise<string | null>
  /** Deletes every object under `materiales/<id>/` and returns how many; it touches no other folder. */
  borrarCarpeta(materialId: string): Promise<number>
}

const PREFIJO_DE_MATERIALES = "materiales/"
export const EXTENSIONES_DE_MATERIAL = new Set([
  "pdf",
  "docx",
  "mp3",
  "m4a",
  "wav",
  "mp4",
  "mov",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
])
const ORDEN_MAXIMO = 20

const CLAVE_DE_MATERIAL = new RegExp(
  `^${PREFIJO_DE_MATERIALES}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original(-(0[1-9]|1\\d|20))?\\.(${[...EXTENSIONES_DE_MATERIAL].join("|")})$`,
)

/** True only for what `claveMaterial` can return: nothing else may be uploaded through a presigned URL. */
function esClaveDeMaterial(clave: string): boolean {
  return CLAVE_DE_MATERIAL.test(clave)
}

/** A browser upload link is short-lived: it only has to outlast one upload. */
const VIGENCIA_MAXIMA_SUBIDA_SEGUNDOS = 60 * 60

function exigirSubida(clave: string, segundos: number): void {
  if (!esClaveDeMaterial(clave)) {
    throw new FallaDeConfiguracion(
      `Solo se sube a una clave de material (${PREFIJO_DE_MATERIALES}<uuid>/original.<ext>): ${clave}`,
    )
  }
  if (!Number.isInteger(segundos) || segundos <= 0 || segundos > VIGENCIA_MAXIMA_SUBIDA_SEGUNDOS) {
    throw new FallaDeConfiguracion(
      `Una URL de subida necesita una vigencia de 1 a ${VIGENCIA_MAXIMA_SUBIDA_SEGUNDOS} segundos enteros: ${segundos}`,
    )
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TEXTO_DE_MATERIAL = new RegExp(
  `^${PREFIJO_DE_MATERIALES}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/texto-original\\.txt$`,
)

/** A download link is for right now: five minutes is plenty and an hour is the most it may ask. */
const VIGENCIA_MAXIMA_DESCARGA_SEGUNDOS = 60 * 60

/** A name that goes inside a quoted header value: plain letters, digits, dots and dashes. */
const NOMBRE_DE_DESCARGA = /^[\w.-]{1,100}$/

function exigirDescarga(clave: string, segundos: number, nombre: string | undefined): void {
  if (!TEXTO_DE_MATERIAL.test(clave)) {
    throw new FallaDeConfiguracion(
      `Solo se firma la descarga de ${PREFIJO_DE_MATERIALES}<uuid>/texto-original.txt: ${clave}`,
    )
  }
  if (!Number.isInteger(segundos) || segundos <= 0 || segundos > VIGENCIA_MAXIMA_DESCARGA_SEGUNDOS) {
    throw new FallaDeConfiguracion(
      `Un link de descarga necesita una vigencia de 1 a ${VIGENCIA_MAXIMA_DESCARGA_SEGUNDOS} segundos enteros: ${segundos}`,
    )
  }
  if (nombre !== undefined && !NOMBRE_DE_DESCARGA.test(nombre)) {
    throw new FallaDeConfiguracion(`Nombre de descarga inválido: ${JSON.stringify(nombre)}`)
  }
}

/** The folder of a material, with the id checked: the only prefix this app ever lists or deletes. */
function carpetaDeMaterial(materialId: string): string {
  if (!UUID.test(materialId)) throw new FallaDeConfiguracion(`El id del material no es un UUID: ${materialId}`)
  return `${PREFIJO_DE_MATERIALES}${materialId.toLowerCase()}/`
}

/** The original of a material; the images of a multi-image material carry their order (1..20) as two digits. */
export function claveMaterial(materialId: string, extension: string, orden?: number): string {
  if (!UUID.test(materialId)) throw new FallaDeConfiguracion(`El id del material no es un UUID: ${materialId}`)
  const ext = extension.toLowerCase()
  if (!EXTENSIONES_DE_MATERIAL.has(ext))
    throw new FallaDeConfiguracion(`Extensión de material no permitida: ${extension}`)
  if (orden === undefined) return `${PREFIJO_DE_MATERIALES}${materialId}/original.${ext}`
  if (!Number.isInteger(orden) || orden < 1 || orden > ORDEN_MAXIMO) {
    throw new FallaDeConfiguracion(`El orden de la imagen va de 1 a ${ORDEN_MAXIMO}: ${orden}`)
  }
  return `${PREFIJO_DE_MATERIALES}${materialId}/original-${String(orden).padStart(2, "0")}.${ext}`
}

export interface AlmacenEnMemoria extends Almacen {
  obtener(clave: string): { datos: Uint8Array; tipo: string } | undefined
  /** Puts an object straight in, as the background task does when it writes the text of a material. */
  poner(clave: string, datos: Uint8Array, tipo: string): void
  claves(): string[]
  /** What the browser's PUT does against a URL from `urlDeSubida`; `{ bytes }` pretends a big object without its data. */
  simularSubida(url: string, datos: Uint8Array | { bytes: number }): void
}

/** A test double with the same contract as the real store, plus a way to look inside. */
export function almacenEnMemoria(): AlmacenEnMemoria {
  const objetos = new Map<string, { datos: Uint8Array; tipo: string; bytes: number }>()
  const subidasPendientes = new Map<string, { clave: string; tipo: string }>()
  return {
    async urlDeSubida(clave, segundos, tipo) {
      exigirSubida(clave, segundos)
      const url = `https://almacen.test/${clave}?subida=${segundos}&tipo=${encodeURIComponent(tipo)}`
      subidasPendientes.set(url, { clave, tipo })
      return url
    },
    simularSubida(url, datos) {
      const subida = subidasPendientes.get(url)
      if (!subida) throw new Error(`Esta URL no salió de urlDeSubida: ${url}`)
      const real = datos instanceof Uint8Array ? new Uint8Array(datos) : new Uint8Array(0)
      const bytes = datos instanceof Uint8Array ? datos.byteLength : datos.bytes
      objetos.set(subida.clave, { datos: real, tipo: subida.tipo, bytes })
    },
    async tamano(clave) {
      return objetos.get(clave)?.bytes ?? null
    },
    async urlFirmada(clave, segundos, opciones = {}) {
      exigirDescarga(clave, segundos, opciones.descargarComo)
      if (!objetos.has(clave)) return null
      const descarga = opciones.descargarComo ? `&descarga=${opciones.descargarComo}` : ""
      return `https://almacen.test/${clave}?expira=${segundos}${descarga}`
    },
    async borrarCarpeta(materialId) {
      const prefijo = carpetaDeMaterial(materialId)
      const claves = [...objetos.keys()].filter((clave) => clave.startsWith(prefijo))
      for (const clave of claves) objetos.delete(clave)
      return claves.length
    },
    poner(clave, datos, tipo) {
      objetos.set(clave, { datos: new Uint8Array(datos), tipo, bytes: datos.byteLength })
    },
    obtener: (clave) => objetos.get(clave),
    claves: () => [...objetos.keys()],
  }
}

function esNoEncontrado(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const { name, $metadata } = error as { name?: unknown; $metadata?: { httpStatusCode?: number } }
  return name === "NotFound" || $metadata?.httpStatusCode === 404
}

export interface OpcionesR2 {
  cuenta: string
  llave: string
  secreto: string
  balde: string
  /** Only for local runs: a fake S3 on this machine instead of the R2 address of the account. */
  endpoint?: string
}

function sinSecretos(texto: string, secretos: readonly string[]): string {
  return secretos.reduce((resto, secreto) => (secreto ? resto.split(secreto).join("[secreto]") : resto), texto)
}

/** A plain Error built from the name, status and message only: the SDK error carries the whole response. */
function fallaDeR2(accion: string, clave: string, error: unknown, secretos: readonly string[]): Error {
  const detalle: { name?: string; message?: string; $metadata?: { httpStatusCode?: number } } =
    typeof error === "object" && error !== null ? error : {}
  const estado = detalle.$metadata?.httpStatusCode
  const motivo = [detalle.name, estado ? `HTTP ${estado}` : undefined, detalle.message].filter(Boolean).join(" · ")
  return new Error(sinSecretos(`R2 no pudo ${accion} ${clave}: ${motivo || "sin detalle"}`, secretos).slice(0, 500))
}

/**
 * Cloudflare R2 through its S3 API (https://developers.cloudflare.com/r2/api/s3/api/). Path-style on the account
 * endpoint. The checksum options are off unless required: the SDK's default sends `aws-chunked` trailers, which R2
 * does not accept (https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).
 */
export function almacenR2(opciones: OpcionesR2): Almacen {
  const { cuenta, llave, secreto, balde, endpoint } = opciones
  const secretos = [secreto, llave]
  const cliente = new S3Client({
    region: "auto",
    endpoint: endpoint ?? `https://${cuenta}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: llave, secretAccessKey: secreto },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })

  return {
    urlDeSubida: async (clave, segundos, tipo) => {
      exigirSubida(clave, segundos)
      try {
        return await getSignedUrl(cliente, new PutObjectCommand({ Bucket: balde, Key: clave, ContentType: tipo }), {
          expiresIn: segundos,
          signableHeaders: new Set(["content-type"]),
        })
      } catch (error) {
        throw fallaDeR2("firmar", clave, error, secretos)
      }
    },
    tamano: async (clave) => {
      try {
        const { ContentLength } = await cliente.send(new HeadObjectCommand({ Bucket: balde, Key: clave }))
        return ContentLength ?? 0
      } catch (error) {
        if (esNoEncontrado(error)) return null
        throw fallaDeR2("medir", clave, error, secretos)
      }
    },
    urlFirmada: async (clave, segundos, opciones = {}) => {
      exigirDescarga(clave, segundos, opciones.descargarComo)
      try {
        // The same contract as the in-memory store: no link for an object that is not there.
        await cliente.send(new HeadObjectCommand({ Bucket: balde, Key: clave }))
      } catch (error) {
        if (esNoEncontrado(error)) return null
        throw fallaDeR2("firmar", clave, error, secretos)
      }
      try {
        return await getSignedUrl(
          cliente,
          new GetObjectCommand({
            Bucket: balde,
            Key: clave,
            ...(opciones.descargarComo
              ? { ResponseContentDisposition: `attachment; filename="${opciones.descargarComo}"` }
              : {}),
          }),
          { expiresIn: segundos },
        )
      } catch (error) {
        throw fallaDeR2("firmar", clave, error, secretos)
      }
    },
    borrarCarpeta: async (materialId) => {
      const prefijo = carpetaDeMaterial(materialId)
      const claves: string[] = []
      try {
        // https://developers.cloudflare.com/r2/api/s3/api/ : ListObjectsV2 with `prefix` and `continuation-token`.
        let siguiente: string | undefined
        do {
          const pagina = await cliente.send(
            new ListObjectsV2Command({ Bucket: balde, Prefix: prefijo, ContinuationToken: siguiente }),
          )
          for (const objeto of pagina.Contents ?? []) {
            if (objeto.Key?.startsWith(prefijo)) claves.push(objeto.Key)
          }
          siguiente = pagina.IsTruncated ? pagina.NextContinuationToken : undefined
        } while (siguiente !== undefined)
      } catch (error) {
        throw fallaDeR2("listar", prefijo, error, secretos)
      }
      for (const clave of claves) {
        try {
          await cliente.send(new DeleteObjectCommand({ Bucket: balde, Key: clave }))
        } catch (error) {
          throw fallaDeR2("borrar", clave, error, secretos)
        }
      }
      return claves.length
    },
  }
}

/** The store of the app, from the R2 variables. `R2_ENDPOINT` (a fake S3 for local runs) is refused on Vercel. */
export function almacenDeEntorno(entorno: Record<string, string | undefined> = process.env): Almacen {
  if (entorno.R2_ENDPOINT && entorno.VERCEL) {
    throw new FallaDeConfiguracion("R2_ENDPOINT no puede estar activo en Vercel: nada llegaría al bucket real.")
  }
  return almacenR2({
    cuenta: exigirEnv("R2_ACCOUNT_ID", entorno.R2_ACCOUNT_ID),
    llave: exigirEnv("R2_ACCESS_KEY_ID", entorno.R2_ACCESS_KEY_ID),
    secreto: exigirEnv("R2_SECRET_ACCESS_KEY", entorno.R2_SECRET_ACCESS_KEY),
    balde: exigirEnv("R2_BUCKET", entorno.R2_BUCKET),
    endpoint: entorno.R2_ENDPOINT || undefined,
  })
}
