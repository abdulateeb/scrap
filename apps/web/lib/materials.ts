/**
 * The material categories a recovery facility works with.
 *
 * This list is the contract between the two applications. apps/api sends these
 * exact keys back in every detection, and the classification prompt is built
 * from the same list, so adding a category here means adding it in
 * apps/api/app/materials.py as well.
 */

export const MATERIAL_KEYS = [
  "plastic",
  "paper",
  "cardboard",
  "metal",
  "glass",
  "organic",
  "textiles",
  "ewaste",
  "other",
] as const;

export type MaterialKey = (typeof MATERIAL_KEYS)[number];

export interface MaterialMeta {
  key: MaterialKey;
  label: string;
  /** Tailwind class fragment resolved from the theme tokens in globals.css. */
  color: string;
  description: string;
}

export const MATERIALS: Record<MaterialKey, MaterialMeta> = {
  plastic: {
    key: "plastic",
    label: "Plastic",
    color: "var(--color-plastic)",
    description: "Bottles, films, rigid packaging and containers.",
  },
  paper: {
    key: "paper",
    label: "Paper",
    color: "var(--color-paper)",
    description: "Newspaper, office paper, magazines and mixed paper.",
  },
  cardboard: {
    key: "cardboard",
    label: "Cardboard",
    color: "var(--color-cardboard)",
    description: "Corrugated boxes, cartons and thick board.",
  },
  metal: {
    key: "metal",
    label: "Metal",
    color: "var(--color-metal)",
    description: "Cans, foil, and ferrous or non ferrous scrap.",
  },
  glass: {
    key: "glass",
    label: "Glass",
    color: "var(--color-glass)",
    description: "Bottles, jars and broken glass pieces.",
  },
  organic: {
    key: "organic",
    label: "Organic",
    color: "var(--color-organic)",
    description: "Food waste, garden waste and other wet fraction.",
  },
  textiles: {
    key: "textiles",
    label: "Textiles",
    color: "var(--color-textiles)",
    description: "Cloth, rags, fabric offcuts and footwear.",
  },
  ewaste: {
    key: "ewaste",
    label: "E-waste",
    color: "var(--color-ewaste)",
    description: "Cables, boards, batteries and small electronics.",
  },
  other: {
    key: "other",
    label: "Other",
    color: "var(--color-other)",
    description: "Anything that does not fall in the categories above.",
  },
};

export const MATERIAL_LIST: MaterialMeta[] = MATERIAL_KEYS.map(
  (key) => MATERIALS[key],
);

export function materialMeta(key: string): MaterialMeta {
  return MATERIALS[key as MaterialKey] ?? MATERIALS.other;
}
