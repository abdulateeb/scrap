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
