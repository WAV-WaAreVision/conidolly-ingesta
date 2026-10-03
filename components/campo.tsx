import type { ReactNode } from "react"

/** Classes of the text fields: 52 px tall for a thumb, tokens only. */
export const CLASES_DE_CAMPO =
  "min-h-13 w-full rounded-md border border-linea bg-superficie px-3.5 py-3 text-body text-tinta placeholder:text-apagado focus:border-acento"

interface PropiedadesDeCampo {
  id: string
  etiqueta: ReactNode
  /** A line under the field; the field points at it with `aria-describedby="<id>-ayuda"`. */
  ayuda?: string
  children: ReactNode
}

/** A label, the field and an optional hint. */
export function Campo({ id, etiqueta, ayuda, children }: PropiedadesDeCampo) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-label font-semibold">
        {etiqueta}
      </label>
      {children}
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-meta text-apagado">
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}
