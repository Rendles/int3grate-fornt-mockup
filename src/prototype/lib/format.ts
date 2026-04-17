export function money(v: number, opts: { compact?: boolean; cents?: boolean } = {}): string {
  if (opts.compact && v >= 1000) {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(v >= 10_000 ? 1 : 2)}k`
  }
  const fr = opts.cents ? 2 : v < 10 ? 2 : 0
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: fr, maximumFractionDigits: fr })}`
}

export function num(v: number): string {
  return v.toLocaleString('en-US')
}

export function pct(v: number, digits = 1): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

export function ago(iso: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  const now = Date.now()
  const diff = now - t
  const s = Math.max(1, Math.floor(diff / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 8) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function absTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function durationMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s - m * 60)
  return `${m}m ${rem}s`
}

export function shortId(id: string): string {
  return id.toUpperCase()
}

export function roleLabel(r: 'admin' | 'domain_admin' | 'member'): string {
  if (r === 'admin') return 'Tenant Admin'
  if (r === 'domain_admin') return 'Domain Admin'
  return 'Member'
}

export function toolDisplay(toolName: string): { provider: string; action: string } {
  const [provider, action = ''] = toolName.split('.')
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return {
    provider: cap(provider.replace(/_/g, ' ')),
    action: action.replace(/_/g, ' '),
  }
}

export function scopeLabel(scopeType: 'tenant' | 'domain' | 'agent', scopeId: string): string {
  if (scopeType === 'tenant') return `tenant · ${scopeId}`
  if (scopeType === 'domain') return `domain · ${scopeId}`
  return `agent · ${scopeId}`
}

export function modeLabel(mode: 'read' | 'write' | 'read_write'): string {
  if (mode === 'read_write') return 'read + write'
  return mode
}
