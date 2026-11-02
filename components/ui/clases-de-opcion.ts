// Not a client module: just the classes of a radio tile whose input is sr-only.

/**
 * A choice is a raised tile, and the chosen one sinks into honda, as Conidolly marks what you picked. The input is
 * sr-only, so the tile carries its focus ring.
 */
export const CLASES_DE_OPCION = [
  "cursor-pointer rounded-bloque bg-piedra shadow-relieve",
  "transition-[box-shadow,background-color] duration-[var(--dur-corta)] ease-salida",
  "has-checked:bg-piedra-honda has-checked:text-tinta has-checked:shadow-hundido",
  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-tinta",
].join(" ")
