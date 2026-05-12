import { Badge } from '@radix-ui/themes'

import { useAuth } from '../../auth'
import { agents as fxAgents } from '../../lib/fixtures'

// Small badge that names the workspace an agent lives in. Visibility is
// driven by an explicit `show` prop set by the parent screen — typically
// based on whether the screen's own page-level workspace filter is
// showing more than one workspace. In single-workspace context the pill
// is just noise, so the parent passes `show={false}` and we render null.
//
// Resolves the workspace via `agent.domain_id` — backend `domain` ≡
// frontend `workspace` (see docs/handoff-prep.md § 0.1), so domain_id IS
// the workspace FK. When wiring to a real backend, this fixtures import
// becomes a server-supplied agent (or workspace name embedded in list rows).

interface Props {
  agentId: string | null | undefined
  /** When true (typically: page-level filter shows >1 workspace), render
      the pill. When false or omitted, render null. */
  show?: boolean
  /** Optional override — when the caller has already resolved the
      workspace name. Skips the fixtures lookup. */
  workspaceName?: string
}

export function WorkspaceContextPill({ agentId, show = false, workspaceName }: Props) {
  const { myWorkspaces } = useAuth()
  if (!show) return null

  let label = workspaceName
  if (!label) {
    if (!agentId) return null
    const agent = fxAgents.find(a => a.id === agentId)
    if (!agent?.domain_id) return null
    const ws = myWorkspaces.find(w => w.id === agent.domain_id)
    if (!ws) return null
    label = ws.name
  }

  return (
    <Badge size="1" color="gray" variant="soft" radius="full">
      in {label}
    </Badge>
  )
}
