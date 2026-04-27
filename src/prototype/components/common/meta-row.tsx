import type { ReactNode } from 'react'
import { DataList } from '@radix-ui/themes'

export function MetaRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <DataList.Item>
      <DataList.Label minWidth="120px">
        {/* Wrapping span lets us apply `::first-letter { text-transform: uppercase }`
            in prototype.css so call sites can keep writing labels in sentence
            case ("created by", "tokens in") and still render them capitalized. */}
        <span className="meta-row__label">{label}</span>
      </DataList.Label>
      <DataList.Value>{value}</DataList.Value>
    </DataList.Item>
  )
}
