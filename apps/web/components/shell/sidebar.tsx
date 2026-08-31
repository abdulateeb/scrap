import Image from "next/image";

import { MATERIAL_LIST } from "@/lib/materials";

/**
 * The sidebar carries the mark and the material key.
 *
 * These nine categories are the vocabulary of the whole product: the model
 * answers in them and the composition is expressed in them, so the key stays on
 * screen and any colour can be read without a legend beside it.
 */
export function Sidebar() {
  return (
    <div className="flex h-full flex-col px-5 py-6">
      <Image
        src="/scrap_wordmark.png"
        alt="Scrap"
        width={4059}
        height={708}
        priority
        className="h-6 w-auto"
      />

      <p className="mt-9 font-mono text-[10px] font-medium tracking-[0.18em] text-ink-faint uppercase">
        Material categories
      </p>
      <ul className="mt-3 space-y-1.5">
        {MATERIAL_LIST.map((material) => (
          <li key={material.key} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: material.color }}
              aria-hidden
            />
            <span className="truncate text-[13px] text-ink-muted">
              {material.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The same two things the sidebar carries, laid out for a phone.
 *
 * The mark sits on its own line so the product is named, and the material key
 * runs underneath as a single row that scrolls sideways. A nine item column
 * would eat most of a phone screen before any of the actual work is visible,
 * but dropping the key altogether would leave the colours on the picture
 * meaning nothing.
 */
export function MobileBar() {
  return (
    <div className="px-4 py-3">
      <Image
        src="/scrap_wordmark.png"
        alt="Scrap"
        width={4059}
        height={708}
        priority
        className="h-5 w-auto"
      />

      <ul className="scroll-slim mt-2.5 flex gap-3 overflow-x-auto pb-1">
        {MATERIAL_LIST.map((material) => (
          <li
            key={material.key}
            className="flex shrink-0 items-center gap-1.5"
          >
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: material.color }}
              aria-hidden
            />
            <span className="text-[11px] whitespace-nowrap text-ink-muted">
              {material.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
