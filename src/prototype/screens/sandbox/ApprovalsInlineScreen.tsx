// SANDBOX preview — design exploration only.
// Reachable through #/app/sandbox/approvals-inline. Sibling sidebar entry to
// Team Bridge, marked with a muted "preview" badge. Used to test inline
// approve/reject affordances on /approvals without disturbing the production
// list. See docs/agent-plans/2026-05-04-1714-approvals-inline-actions-sandbox.md
// for the full plan and rationale. Safe to delete this file + the route in
// index.tsx + the sidebar entry in shell.tsx if the direction is rejected.
//
// SANDBOX RULE: never call api.decideApproval — fixtures are shared with the
// production /approvals list, and a real mutation would leak into both. Local
// state only. See § 4 of the plan.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Code, Flex, Grid, IconButton, Text } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { Avatar, Caption, MockBadge, PageHeader, Status } from '../../components/common'
import { TextAreaField } from '../../components/fields'
import { Banner, EmptyState, ErrorState, LoadingList } from '../../components/states'
import { IconApproval, IconArrowLeft, IconArrowRight, IconCheck, IconX } from '../../components/icons'
import { useRouter } from '../../router'
import { api } from '../../lib/api'
import { APPROVAL_STATUS_FILTERS } from '../../lib/filters'
import type { ApprovalStatusFilter } from '../../lib/filters'
import type { Agent, ApprovalRequest, RunListItem } from '../../lib/types'
import { ago, prettifyRequestedAction } from '../../lib/format'

// 12 cards = 4 rows of 3 on lg / 6 rows of 2 on md / 12 on small. Keeps
// the first paint compact and lets the IntersectionObserver fire as soon
// as the user starts scrolling. Mirrors RunsScreen's approach.
const PAGE_SIZE = 12

// 5 seconds — long enough to catch a misclick, short enough that the user
// doesn't expect this to be a real "I changed my mind" workflow.
const UNDO_WINDOW_MS = 5000

interface UndoToast {
  id: string
  approvalId: string
  decision: 'approved' | 'rejected'
  agentName: string
  actionVerb: string
  expiresAt: number
}

// Module-level helpers — kept out of the component so React's purity lint
// rule doesn't flag the (intentional) Date.now / Math.random calls. These
// only run from event handlers, so impurity is fine.
function makeToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
function nowMs(): number {
  return Date.now()
}

export default function ApprovalsInlineScreen() {
  const { navigate } = useRouter()
  const [items, setItems] = useState<ApprovalRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [runs, setRuns] = useState<RunListItem[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('pending')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // SANDBOX-local state — never written through to the backend. See § 4 of
  // the plan for why we never call api.decideApproval here.
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => new Set())
  const [expandedRejectId, setExpandedRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTouched, setRejectTouched] = useState(false)
  const [toasts, setToasts] = useState<UndoToast[]>([])

  const markResolved = (id: string) => {
    setResolvedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const clearReject = () => {
    setExpandedRejectId(null)
    setRejectReason('')
    setRejectTouched(false)
  }

  const pushToast = (
    approvalId: string,
    decision: 'approved' | 'rejected',
    agentName: string,
    actionVerb: string,
  ) => {
    const toast: UndoToast = {
      id: makeToastId(),
      approvalId,
      decision,
      agentName,
      actionVerb,
      expiresAt: nowMs() + UNDO_WINDOW_MS,
    }
    // Cap stack at 5 — older toasts get pushed out before they expire if the
    // user is approving very rapidly. Their underlying decisions stay
    // committed; only the undo handle is lost.
    setToasts(prev => [...prev, toast].slice(-5))
  }

  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }

  const undoToast = (toastId: string) => {
    setToasts(prev => {
      const t = prev.find(x => x.id === toastId)
      if (t) {
        setResolvedIds(rs => {
          const next = new Set(rs)
          next.delete(t.approvalId)
          return next
        })
      }
      return prev.filter(x => x.id !== toastId)
    })
  }

  const onApprove = (id: string, agentName: string, actionVerb: string) => {
    markResolved(id)
    if (expandedRejectId === id) clearReject()
    pushToast(id, 'approved', agentName, actionVerb)
  }

  const onRejectStart = (id: string) => {
    // Opening reject for one row closes any pending form on another row,
    // dropping its in-progress reason. Single-active-form keeps state simple.
    setExpandedRejectId(id)
    setRejectReason('')
    setRejectTouched(false)
  }

  const onRejectConfirm = (id: string, agentName: string, actionVerb: string) => {
    setRejectTouched(true)
    if (rejectReason.trim().length < 4) return
    markResolved(id)
    clearReject()
    pushToast(id, 'rejected', agentName, actionVerb)
  }

  const hasSandboxState = resolvedIds.size > 0 || toasts.length > 0 || expandedRejectId !== null
  const onResetPreview = () => {
    setResolvedIds(new Set())
    setToasts([])
    clearReject()
  }

  // Initial load — also re-fires on filter change. Resets the paged list,
  // because changing the filter is a fresh query, not a continuation.
  // The reset setters here are intentional — same pattern as RunsScreen.
  useEffect(() => {
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setItems([])
    setPage(0)
    setTotal(0)
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([
      api.listApprovals({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: 0,
      }),
      api.listRuns({ limit: 100 }),
      api.listAgents(),
    ])
      .then(([list, r, a]) => {
        if (cancelled) return
        setItems(list.items)
        setTotal(list.total)
        setRuns(r.items)
        setAgents(a.items)
        setError(null)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load approvals')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [statusFilter, reloadTick])

  // Append the next page. Guarded so concurrent triggers (scroll + ad-hoc
  // calls) don't fire two parallel requests. Mirrors RunsScreen.
  const loadMore = async () => {
    if (loadingMore || loading) return
    if (items.length >= total) return
    setLoadingMore(true)
    const nextPage = page + 1
    try {
      const list = await api.listApprovals({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      })
      setItems(prev => [...prev, ...list.items])
      setPage(nextPage)
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  // Auto-load on scroll: IntersectionObserver fires loadMore when the
  // sentinel enters the viewport (200px pre-load margin).
  useEffect(() => {
    const target = sentinelRef.current
    if (!target) return
    if (items.length >= total) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '200px' })
    observer.observe(target)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, total, statusFilter, loading, loadingMore])

  const agentNameByRun = useMemo(() => {
    const m = new Map<string, string>()
    const byAgent = new Map<string, Agent>()
    for (const a of agents) byAgent.set(a.id, a)
    for (const r of runs) {
      if (!r.agent_id) continue
      const a = byAgent.get(r.agent_id)
      if (a) m.set(r.id, a.name)
    }
    return m
  }, [runs, agents])

  // Sandbox-resolved cards are filtered out — they simply disappear from
  // the preview (we don't fake-move them to the "approved"/"rejected" tab).
  // Order is server-natural (newest first), mirroring RunsScreen's
  // infinite-scroll pattern. Counts reflect what's been loaded so far —
  // approximate but consistent across paged loads.
  const visible = useMemo(
    () => items.filter(a => !resolvedIds.has(a.id)),
    [items, resolvedIds],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visible.length }
    visible.forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [visible])

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'approvals preview' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · APPROVALS PREVIEW</span>
              <MockBadge kind="design" hint="Sandbox preview. Approve / reject in this view does not persist — fixtures are shared with the production /approvals list and the sandbox does not call the decideApproval endpoint." />
            </Flex>
          }
          title={<>Pending <em>approvals</em> — inline actions.</>}
          subtitle="Approve or reject without leaving the list. Refresh to start over."
          actions={
            hasSandboxState ? (
              <Button
                variant="soft"
                color="gray"
                size="2"
                onClick={onResetPreview}
                title="Bring back every row you've cleared in this preview"
              >
                Reset preview
              </Button>
            ) : null
          }
        />

        <Box mb="4">
          <Banner
            tone="info"
            title="This is a preview — actions don't persist"
            icon={<IconApproval className="ic" />}
          >
            Approve and reject buttons in this view are inline-action design
            exploration. Decisions never reach the backend, and the production
            <Text as="span"> /approvals </Text>
            list is unchanged. Reload the page or use Reset preview to bring
            back any rows you've cleared here.
          </Banner>
        </Box>

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Caption mr="1">status</Caption>
          {APPROVAL_STATUS_FILTERS.map(f => {
            const isActive = statusFilter === f
            const activeColor = f === 'pending' ? 'amber' : 'blue'
            return (
              <Button
                key={f}
                type="button"
                size="2"
                variant="soft"
                color={isActive ? activeColor : 'gray'}
                onClick={() => { setStatusFilter(f); setPage(0) }}
              >
                <span style={{ textTransform: 'capitalize' }}>{f}</span>
                <Code variant="ghost" size="1" color="gray">{counts[f] ?? 0}</Code>
              </Button>
            )
          })}
        </Flex>

        {error ? (
          <ErrorState
            title="Couldn't load approvals"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : loading ? (
          <LoadingList rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<IconApproval />}
            title={statusFilter === 'pending' ? 'All caught up' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}approval requests`}
            body={
              statusFilter === 'pending'
                ? "Nothing is waiting for your decision. Inline actions will appear on each row when there are pending requests."
                : "Switch the filter to Pending to see what's waiting on you right now."
            }
          />
        ) : (
          <>
            <Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3">
              {visible.map(a => {
                const agentName = agentNameByRun.get(a.run_id) ?? 'Agent'
                const actionVerb = prettifyRequestedAction(a.requested_action).toLowerCase()
                return (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    agentName={agentName}
                    actionVerb={actionVerb}
                    isRejectExpanded={expandedRejectId === a.id}
                    rejectReason={rejectReason}
                    rejectTouched={rejectTouched}
                    onOpenDetail={() => navigate(`/approvals/${a.id}`)}
                    onApprove={() => onApprove(a.id, agentName, actionVerb)}
                    onRejectStart={() => onRejectStart(a.id)}
                    onChangeReason={v => { setRejectReason(v); setRejectTouched(true) }}
                    onBlurReason={() => setRejectTouched(true)}
                    onRejectCancel={clearReject}
                    onRejectConfirm={() => onRejectConfirm(a.id, agentName, actionVerb)}
                  />
                )
              })}
            </Grid>

            {items.length < total ? (
              <Box ref={sentinelRef} mt="4" py="4" style={{ textAlign: 'center' }}>
                {loadingMore ? (
                  <Text size="2" color="gray">Loading more…</Text>
                ) : (
                  <Text size="2" color="gray">
                    Scroll for more · {items.length} of {total}
                  </Text>
                )}
              </Box>
            ) : total > 0 ? (
              <Box mt="4" py="4" style={{ textAlign: 'center' }}>
                <Text size="2" color="gray">
                  All caught up · {total} {total === 1 ? 'approval' : 'approvals'}
                </Text>
              </Box>
            ) : null}
          </>
        )}
      </div>
      <ToastStack toasts={toasts} onUndo={undoToast} onDismiss={dismissToast} />
    </AppShell>
  )
}

// ─── ApprovalCard ───────────────────────────────────────────────────────
// Card-style preview of a single approval. Avatar + name in header,
// "wants to" + action verb in body, wide Details button + ✓/✕ icon
// buttons on the right. Reject expands a reason form inside the card.

interface ApprovalCardProps {
  approval: ApprovalRequest
  agentName: string
  actionVerb: string
  isRejectExpanded: boolean
  rejectReason: string
  rejectTouched: boolean
  onOpenDetail: () => void
  onApprove: () => void
  onRejectStart: () => void
  onChangeReason: (v: string) => void
  onBlurReason: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
}

function ApprovalCard(props: ApprovalCardProps) {
  const { approval, agentName, actionVerb, isRejectExpanded, onOpenDetail, onApprove, onRejectStart } = props
  const isPending = approval.status === 'pending'

  return (
    <div
      className="card"
      style={{
        padding: 16,
        gap: 12,
        display: 'flex',
        flexDirection: 'column',
        borderColor: isRejectExpanded ? 'var(--red-a6)' : undefined,
      }}
    >
      <Flex align="center" gap="3" minWidth="0">
        <Avatar initials={agentName.slice(0, 2).toUpperCase()} size={36} />
        <Box minWidth="0" flexGrow="1">
          <Text as="div" size="3" weight="medium" className="truncate">{agentName}</Text>
          <Text as="div" size="1" color="gray" mt="1" className="truncate">
            {approval.requested_by_name
              ? `Triggered by ${approval.requested_by_name} · ${ago(approval.created_at)}`
              : ago(approval.created_at)}
          </Text>
        </Box>
        <Status status={approval.status} />
      </Flex>
      <Box>
        <Caption mb="1">wants to</Caption>
        <Text as="div" size="2" weight="medium" style={{ lineHeight: 1.45 }}>
          {actionVerb}
        </Text>
      </Box>
      <Flex direction="column" gap="2" style={{ marginTop: 'auto' }}>
        {isRejectExpanded ? (
          <RejectFormBody {...props} />
        ) : (
          <Flex gap="2" align="center">
            <Button size="2" variant="soft" onClick={onOpenDetail} style={{ flex: 1, minWidth: 0 }}>
              View full details
              <IconArrowRight className="ic ic--sm" />
            </Button>
            {isPending && (
              <>
                <IconButton size="2" variant="soft" color="green" onClick={onApprove}
                  title="Quick approve" aria-label={`Quick approve — ${agentName} ${actionVerb}`}>
                  <IconCheck className="ic ic--sm" />
                </IconButton>
                <IconButton size="2" variant="soft" color="red" onClick={onRejectStart}
                  title="Quick reject" aria-label={`Quick reject — ${agentName} ${actionVerb}`}>
                  <IconX className="ic ic--sm" />
                </IconButton>
              </>
            )}
          </Flex>
        )}
      </Flex>
    </div>
  )
}

function RejectFormBody({
  rejectReason, rejectTouched, onChangeReason, onBlurReason, onRejectCancel, onRejectConfirm,
}: ApprovalCardProps) {
  const reasonInvalid = rejectTouched && rejectReason.trim().length < 4
  return (
    <Box
      style={{
        padding: 12,
        background: 'var(--red-a2)',
        border: '1px solid var(--red-a4)',
        borderRadius: 6,
      }}
    >
      <Flex align="center" justify="between" mb="2">
        <Caption>
          reason for rejecting <Text as="span" color="red">*</Text>
        </Caption>
        <Code variant="ghost" size="1" color="gray">≥ 4 chars</Code>
      </Flex>
      <TextAreaField
        autoFocus
        style={{ minHeight: 72 }}
        placeholder="Why are we rejecting?"
        value={rejectReason}
        onChange={e => onChangeReason(e.target.value)}
        onBlur={onBlurReason}
        error={reasonInvalid ? 'At least 4 characters.' : undefined}
      />
      <Flex justify="end" gap="2" mt="3">
        <Button variant="soft" color="gray" size="2" onClick={onRejectCancel}>
          <IconArrowLeft className="ic ic--sm" />
          Cancel
        </Button>
        <Button color="red" size="2" onClick={onRejectConfirm}>
          <IconX className="ic ic--sm" />
          Confirm reject
        </Button>
      </Flex>
    </Box>
  )
}

// ─── ToastStack ─────────────────────────────────────────────────────────
// Bottom-right stack of undo-toasts. Each toast counts down 5 seconds; on
// expiry the toast removes itself (decision stays committed in sandbox-
// state). Clicking Undo removes the toast AND restores the row.

function ToastStack({
  toasts,
  onUndo,
  onDismiss,
}: {
  toasts: UndoToast[]
  onUndo: (toastId: string) => void
  onDismiss: (toastId: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 80,
        pointerEvents: 'none',
      }}
    >
      <Flex direction="column" gap="2" align="end">
        {toasts.map(t => (
          <ToastItem
            key={t.id}
            toast={t}
            onUndo={() => onUndo(t.id)}
            onDismiss={() => onDismiss(t.id)}
          />
        ))}
      </Flex>
    </Box>
  )
}

function ToastItem({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: UndoToast
  onUndo: () => void
  onDismiss: () => void
}) {
  const computeRemaining = () =>
    Math.max(0, Math.ceil((toast.expiresAt - Date.now()) / 1000))
  const [remaining, setRemaining] = useState(computeRemaining)

  useEffect(() => {
    const tick = setInterval(() => {
      const left = toast.expiresAt - Date.now()
      if (left <= 0) {
        clearInterval(tick)
        onDismiss()
        return
      }
      setRemaining(Math.ceil(left / 1000))
    }, 250)
    return () => clearInterval(tick)
  }, [toast.expiresAt, onDismiss])

  const isApprove = toast.decision === 'approved'
  const accentColor = isApprove ? 'var(--green-11)' : 'var(--red-11)'
  const accentBorder = isApprove ? 'var(--green-a6)' : 'var(--red-a6)'

  return (
    <Flex
      align="center"
      gap="3"
      role="status"
      aria-live="polite"
      style={{
        pointerEvents: 'auto',
        background: 'var(--gray-2)',
        border: `1px solid ${accentBorder}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        padding: '10px 14px',
        minWidth: 320,
        maxWidth: 420,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: `1px solid ${accentBorder}`,
          color: accentColor,
          background: 'var(--gray-3)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {isApprove ? <IconCheck className="ic ic--sm" /> : <IconX className="ic ic--sm" />}
      </span>
      <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Text as="div" size="2" weight="medium" className="truncate">
          <Text as="span" style={{ color: accentColor }}>
            {isApprove ? 'Approved' : 'Rejected'}
          </Text>
          <Text as="span" color="gray">{' · '}</Text>
          <Text as="span">{toast.agentName}</Text>
        </Text>
        <Text as="div" size="1" color="gray" className="truncate" mt="1">
          {toast.actionVerb}
        </Text>
      </Box>
      <Button
        variant="soft"
        color="gray"
        size="1"
        onClick={onUndo}
        aria-label={`Undo — ${toast.agentName} ${toast.actionVerb}`}
        style={{ flexShrink: 0 }}
      >
        Undo ({remaining}s)
      </Button>
    </Flex>
  )
}
