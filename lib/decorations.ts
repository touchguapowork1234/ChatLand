export type Decoration = {
  id: string
  label: string
  src: string
}

export const DECORATIONS: Decoration[] = [
  { id: 'cat_ears', label: 'Cat Ears', src: '/decorations/cat_ears.png' },
]

export const decorationById = (id: string | null | undefined): Decoration | undefined =>
  id ? DECORATIONS.find(d => d.id === id) : undefined
