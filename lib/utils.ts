import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The custom scale of app/globals.css (Conidolly's, lib/utils.ts there). Without it tailwind-merge reads `text-meta` as
// a colour and drops it next to `text-tinta`. Keep these lists in step with the @theme block of globals.css.
const fusionar = extendTailwindMerge({
  extend: {
    theme: {
      text: ["pantalla", "pieza", "guion", "boton", "cuerpo", "meta"],
      shadow: ["relieve", "relieve-alto", "relieve-fijo", "hundido"],
      radius: ["control", "panel", "bloque", "casilla"],
      spacing: ["objetivo", "boton", "nav"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return fusionar(clsx(inputs))
}
