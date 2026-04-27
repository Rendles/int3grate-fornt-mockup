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

export function roleLabel(r: 'admin' | 'domain_admin' | 'member'): string {
  if (r === 'admin') return 'Tenant Admin'
  if (r === 'domain_admin') return 'Domain Admin'
  return 'Member'
}

// Tool grant mode (CRUD axis) — `read | write | read_write`.
export function grantModeLabel(m: 'read' | 'write' | 'read_write'): string {
  if (m === 'read') return 'Read'
  if (m === 'write') return 'Write'
  return 'Read & write'
}

// Tool policy mode (catalog / snapshot axis) — `read_only | requires_approval | denied`.
export function policyModeLabel(m: 'read_only' | 'requires_approval' | 'denied'): string {
  if (m === 'read_only') return 'Read only'
  if (m === 'requires_approval') return 'Requires approval'
  return 'Denied'
}

// Tool execution error kinds inside a run timeline.
export function toolErrorStatusLabel(s: 'error' | 'timeout' | 'denied'): string {
  if (s === 'error') return 'Error'
  if (s === 'timeout') return 'Timeout'
  return 'Denied'
}

// Run-level error classification.
export function errorKindLabel(k: 'none' | 'tool_error' | 'orchestrator_error' | 'timeout' | 'cancelled'): string {
  if (k === 'tool_error') return 'Tool error'
  if (k === 'orchestrator_error') return 'Orchestrator error'
  if (k === 'timeout') return 'Timeout'
  if (k === 'cancelled') return 'Cancelled'
  return 'None'
}

// Strip a leading `service.action` tool key out of a requested_action string
// and replace it with the friendly tool label. Keeps the rest of the message
// (amounts, IDs, descriptions) as-is. Examples:
//   "stripe.refund · $412 on charge ch_3P8fL2"  →  "Stripe · Refund · $412 on charge ch_3P8fL2"
//   "email.send batch × 6 · outreach drafts"    →  "Email · Send batch × 6 · outreach drafts"
export function prettifyRequestedAction(s: string): string {
  const m = /^([a-z0-9_]+\.[a-z0-9_]+)(.*)$/i.exec(s)
  if (!m) return s
  return `${toolLabel(m[1])}${m[2]}`
}

// Best-effort approver_role → friendly label. The spec lets approver_role be
// any string; treat known role keys via roleLabel and fall back to a Title
// Case version of the raw value.
export function approverRoleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  if (role === 'admin' || role === 'domain_admin' || role === 'member') {
    return roleLabel(role)
  }
  return role.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

// Snake-case key → "Sentence case" label. Used for any place where backend
// keys (`charge_id`, `attached_policies`, `iam_user`) need to be shown to
// humans without the snake.
export function humanKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

const DOMAIN_LABELS: Record<string, string> = {
  dom_hq: 'HQ',
  dom_sales: 'Sales',
  dom_support: 'Support',
}

export function domainLabel(id: string | null | undefined): string {
  if (!id) return '—'
  return DOMAIN_LABELS[id] ?? id.replace(/^dom_/, '').replace(/_/g, ' ')
}

const TENANT_LABELS: Record<string, string> = {
  ten_acme: 'Acme',
}

export function tenantLabel(id: string | null | undefined): string {
  if (!id) return '—'
  return TENANT_LABELS[id] ?? id.replace(/^ten_/, '')
}

// Strip an entity prefix and return a short, human-friendly reference like "#4081".
// Useful in breadcrumbs and headers where users navigate by short numeric handles.
export function shortRef(id: string | null | undefined): string {
  if (!id) return '—'
  const m = id.match(/_(\w+)$/)
  if (!m) return id
  const tail = m[1]
  return /^\d+$/.test(tail) ? `#${tail}` : tail
}

const STAGE_LABELS: Record<string, string> = {
  approval_gate: 'Waiting on approval',
  validation: 'Validation',
  llm_call: 'LLM call',
  tool_call: 'Tool call',
  memory_read: 'Memory read',
  memory_write: 'Memory write',
}

// "approval_gate · stripe.refund" → "Waiting on approval · Stripe · Refund"
export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return '—'
  const parts = stage.split('·').map(p => p.trim()).filter(Boolean)
  return parts
    .map(p => {
      if (STAGE_LABELS[p]) return STAGE_LABELS[p]
      if (TOOL_LABELS[p]) return TOOL_LABELS[p]
      return p.replace(/_/g, ' ')
    })
    .join(' · ')
}

const STEP_KIND_LABELS: Record<string, string> = {
  llm_call: 'LLM call',
  tool_call: 'Tool call',
  memory_read: 'Memory read',
  memory_write: 'Memory write',
  approval_gate: 'Approval gate',
  validation: 'Validation',
}

export function stepKindLabel(kind: string): string {
  return STEP_KIND_LABELS[kind] ?? kind.replace(/_/g, ' ')
}

// Tool key → human label. Format: "Service · Action".
// Falls back to the raw key if unmapped (so new fixtures don't crash the UI).
export const TOOL_LABELS: Record<string, string> = {
  'stripe.read_charge': 'Stripe · Read Charge',
  'stripe.refund': 'Stripe · Refund',
  'zoho_crm.read_contact': 'Zoho CRM · Read Contact',
  'zoho_crm.write_deal': 'Zoho CRM · Write Deal',
  'apollo.enrich_contact': 'Apollo · Enrich Contact',
  'email.send': 'Email · Send',
  'okta.create_user': 'Okta · Create User',
  'okta.read_user': 'Okta · Read User',
  'aws.revoke_user': 'AWS · Revoke User',
  'irs.verify_ein': 'IRS · Verify EIN',
  'quickbooks.read_invoice': 'QuickBooks · Read Invoice',
  'slack.post_message': 'Slack · Post Message',
  'memory.read': 'Memory · Read',
  'web_search': 'Web Search',
  'kb.lookup': 'Knowledge Base · Lookup',
}

export function toolLabel(key: string | null | undefined): string {
  if (!key) return '—'
  return TOOL_LABELS[key] ?? key
}
