import Image from "next/image";

import { ApiKeyDialog } from "@/components/shell/api-key-dialog";
import { SectionLabel } from "@/components/ui/card";
import { MATERIAL_LIST } from "@/lib/materials";

/**
 * The sidebar carries the mark, the material key and the settings.
 *
 * These nine categories are the vocabulary of the whole product: the model
 * answers in them and the composition is expressed in them, so the key stays on
 * screen and any colour can be read without a legend beside it.
 *
 * Settings sit at the foot of the column rather than beside the mark, because
 * changing a key is something done once in a while and it should never compete
 * with the material key for attention.
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
        // The picture file carries empty space of its own down both sides,
        // which pushed the mark noticeably further in than the headings below
        // it. Pulling it back by that much lines the S up with everything else
        // in the column.
        className="-ml-3 h-6 w-auto"
      />

      <SectionLabel className="mt-9">Material categories</SectionLabel>
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

      {/* No heading over it. One button does not need a section named for it,
          and the label said less than the button already does. */}
      <div className="mt-auto pt-8">
        {/* Sized by its own label. Stretched across the column it stopped
            looking like a control and started looking like a bar. */}
        <ApiKeyDialog />
      </div>
    </div>
  );
}

/**
 * The same things the sidebar carries, laid out for a phone.
 *
 * The mark sits on its own line so the product is named, with the key control
 * on the end of that line, and the material key runs underneath as a single row
 * that scrolls sideways. A nine item column would eat most of a phone screen
 * before any of the actual work is visible, but dropping the key altogether
 * would leave the colours on the picture meaning nothing.
 */
export function MobileBar() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <Image
          src="/scrap_wordmark.png"
          alt="Scrap"
          width={4059}
          height={708}
          priority
          // Same empty space in the file, and the mark is smaller here, so it
          // is pulled back by a little less.
          className="-ml-2.5 h-5 w-auto"
        />

        <ApiKeyDialog className="shrink-0" label="API key" />
      </div>

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
