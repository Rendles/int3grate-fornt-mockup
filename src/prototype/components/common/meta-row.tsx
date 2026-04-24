import type { ReactNode } from 'react'
import { DataList } from '@radix-ui/themes'

export function MetaRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <DataList.Item>
      <DataList.Label minWidth="120px">{label}</DataList.Label>
      <DataList.Value>{value}</DataList.Value>
    </DataList.Item>
  )
}
