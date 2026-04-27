import { humanKey } from '../../lib/format'
import { STATUS_MAP } from './status-data'

// Friendly label-only accessor for the same map used by <Status>.
// Use it when copy needs text instead of the full status pill.
export function statusLabel(s: string): string {
  return STATUS_MAP[s as keyof typeof STATUS_MAP]?.label ?? humanKey(s)
}
