import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Code, Flex, Grid, IconButton, SegmentedControl, Text } from '@radix-ui/themes'
import { GridViewIcon, Menu01Icon } from '@hugeicons/core-free-icons'

import { AppShell } from '../components/shell'
import { Avatar, Caption, PageHeader, Status, WorkspaceContextPill, WorkspaceFilter } from '../components/common'
import { Banner, EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconApproval, IconArrowRight, IconCheck, IconX } from '../components/icons'
import { Icon } from '../components/icon'
import { ApprovalCard } from '../components/approval-card'
import { RejectInlineForm } from '../components/reject-inline-form'
import { ToastStack } from '../components/undo-toast'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { api } from '../lib/api'
import { APPROVAL_STATUS_FILTERS } from '../lib/filters'
import type { ApprovalStatusFilter } from '../lib/filters'
import type { Agent, ApprovalRequest, RunListItem } from '../lib/types'
import { makeToastId, nowMs, type UndoToast } from '../lib/undo-toast'
import { ago, prettifyRequestedAction } from '../lib/format'
import { shouldShowWorkspacePill, useScopeFilter } from '../lib/scope-filter'

// Reject reason — UI-only validation. Backend spec has no minimum length;
// 4 chars is the same threshold used in the sandbox preview to discourage
// "no" / "x" type non-reasons. Tighten to 10 if reviewer asks.
const REJECT_REASON_MIN = 4

// Deferred-commit window. The user has this long after clicking ✓/✕ to hit
// Undo before the decision actually fires at api.decideApproval. 5s mirrors
// Gmail's send-undo and is what the sandbox uses.
const UNDO_WINDOW_MS = 5000

// Cap on simultaneous toasts. Older ones get pushed out before they expire
// if the user is approving very rapidly. Their underlying decisions stay
// scheduled — only the visual undo handle is lost.
const TOAST_STACK_MAX = 5

// Page size for infinite-scroll loading. Same as sandbox: 12 fits a 4×3
// grid on lg viewports, 6×2 on md, 12×1 on sm. In table view it's just 12
// rows in the first paint — comfortable scroll trigger before the
// IntersectionObserver fires on the sentinel.
const PAGE_SIZE = 12

type ApprovalsViewMode = 'cards' | 'table'

// Persisted across reloads so an admin who prefers the dense table view
// doesn't keep flipping back from cards every time they re-open
// /approvals. Versioned key so we can change the value space later
// without parsing legacy strings.
const VIEW_MODE_STORAGE_KEY = 'proto.approvals.view.v1'

function readStoredViewMode(): ApprovalsViewMode {
  if (typeof window === 'undefined') return 'cards'
  const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
  return raw === 'table' || raw === 'cards' ? raw : 'cards'
}

interface PendingDecision {
  decision: 'approved' | 'rejected'
  reason: string | null
}

interface RejectTarget {
  approval: ApprovalRequest
  agentName: string
  actionVerb: string
}

export default function ApprovalsScreen() {
  const { user, myWorkspaces } = useAuth()
  const { filter: workspaceFilter } = useScopeFilter()
  const { navigate } = useRouter()
  // Items are appended page-by-page as the user scrolls. Order = server
  // order (newest first per spec). We don't re-sort client-side — that
  // would be incompatible with infinite scroll (we'd reorder rows on
  // every additional load).
  const [items, setItems] = useState<ApprovalRequest[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [runs, setRuns] = useState<RunListItem[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('pending')
  const [viewMode, setViewMode] = useState<ApprovalsViewMode>(readStoredViewMode)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
  }, [viewMode])

  // Reject inline-form state. `rejectTarget` doubles as "which row is
  // expanded" — null when none, populated when the user clicks ✕ on a row.
  // Single-active-form: opening reject on row B closes any open form on
  // row A and drops its in-progress reason.
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTouched, setRejectTouched] = useState(false)

  // Deferred-commit state. `pendingIds` is the visible-list filter (rows
  // hidden during the 5s undo window). `toasts` drives the bottom-right
  // stack. Timers and decision payloads are kept in refs because they're
  // bookkeeping — we don't want them to trigger re-renders, and we want
  // the unmount cleanup to read the latest values without stale-closure
  // bugs.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const [toasts, setToasts] = useState<UndoToast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingDecisionsRef = useRef<Map<string, PendingDecision>>(new Map())
  const userIdRef = useRef<string | undefined>(undefined)

  // Keep userIdRef synced with the current user id. Refs can't be mutated
  // during render in React 19, so an effect is the canonical channel.
  useEffect(() => {
    userIdRef.current = user?.id
  }, [user?.id])

  const restoreRow = (approvalId: string) => {
    setPendingIds(prev => {
      if (!prev.has(approvalId)) return prev
      const next = new Set(prev)
      next.delete(approvalId)
      return next
    })
  }

  // Fires the real api call. Called by the per-row setTimeout when its
  // 5-second window expires (or synchronously by the unmount cleanup).
  // already_resolved means another admin beat us to it — restore the row
  // and refetch so the user sees the actual current state.
  const commitDecision = async (
    approvalId: string,
    decision: 'approved' | 'rejected',
    reason: string | null,
  ) => {
    const userId = userIdRef.current
    if (!userId) return
    try {
      await api.decideApproval(approvalId, decision, reason, userId)
    } catch (e) {
      const err = e as Error & { code?: string }
      if (err.code === 'already_resolved') {
        restoreRow(approvalId)
        setReloadTick(t => t + 1)
      } else {
        restoreRow(approvalId)
        setError(err.message ?? 'Could not record decision')
      }
    }
  }

  const scheduleCommit = (
    approvalId: string,
    decision: 'approved' | 'rejected',
    reason: string | null,
    agentName: string,
    actionVerb: string,
  ) => {
    // Already scheduled? Ignore — guards against double-clicks.
    if (timersRef.current.has(approvalId)) return

    setPendingIds(prev => {
      const next = new Set(prev)
      next.add(approvalId)
      return next
    })
    pendingDecisionsRef.current.set(approvalId, { decision, reason })

    const toast: UndoToast = {
      id: makeToastId(),
      approvalId,
      decision,
      agentName,
      actionVerb,
      expiresAt: nowMs() + UNDO_WINDOW_MS,
    }
    setToasts(prev => [...prev, toast].slice(-TOAST_STACK_MAX))

    const timer = setTimeout(() => {
      timersRef.current.delete(approvalId)
      pendingDecisionsRef.current.delete(approvalId)
      void commitDecision(approvalId, decision, reason)
    }, UNDO_WINDOW_MS)
    timersRef.current.set(approvalId, timer)
  }

  const handleApprove = (approval: ApprovalRequest, agentName: string, actionVerb: string) => {
    scheduleCommit(approval.id, 'approved', null, agentName, actionVerb)
  }
  const handleRejectStart = (approval: ApprovalRequest, agentName: string, actionVerb: string) => {
    setRejectTarget({ approval, agentName, actionVerb })
    setRejectReason('')
    setRejectTouched(false)
  }
  const closeReject = () => {
    setRejectTarget(null)
    setRejectReason('')
    setRejectTouched(false)
  }
  const confirmReject = () => {
    if (!rejectTarget) return
    setRejectTouched(true)
    const reason = rejectReason.trim()
    if (reason.length < REJECT_REASON_MIN) return
    scheduleCommit(
      rejectTarget.approval.id,
      'rejected',
      reason,
      rejectTarget.agentName,
      rejectTarget.actionVerb,
    )
    closeReject()
  }

  // Toast handlers. `undoToast` is fired from the Undo button — cancels the
  // pending decision and brings the row back. `dismissToast` is fired from
  // the toast itself when its countdown hits 0 — at that point the commit
  // timer is also firing in parallel, so we just clean up the toast slot.
  const undoToast = (toastId: string) => {
    const t = toasts.find(x => x.id === toastId)
    if (t) {
      const timer = timersRef.current.get(t.approvalId)
      if (timer !== undefined) clearTimeout(timer)
      timersRef.current.delete(t.approvalId)
      pendingDecisionsRef.current.delete(t.approvalId)
      restoreRow(t.approvalId)
    }
    setToasts(prev => prev.filter(x => x.id !== toastId))
  }
  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(x => x.id !== toastId))
  }

  // Unmount flush — fire any in-flight decisions immediately so the user
  // doesn't lose them by navigating away mid-undo-window. Empty deps; the
  // user id is read through a ref so this cleanup never goes stale. Maps
  // are captured into local consts on mount so the cleanup binds to the
  // same instance the rest of the component is mutating.
  useEffect(() => {
    const timers = timersRef.current
    const pendingDecisions = pendingDecisionsRef.current
    return () => {
      const userId = userIdRef.current
      for (const [approvalId, timer] of timers.entries()) {
        clearTimeout(timer)
        const pending = pendingDecisions.get(approvalId)
        if (pending && userId) {
          // Fire-and-forget — we're unmounting, nothing to await.
          void api
            .decideApproval(approvalId, pending.decision, pending.reason, userId)
            .catch(() => {})
        }
      }
      timers.clear()
      pendingDecisions.clear()
    }
  }, [])

  // Initial load — also re-fires on filter change. Resets the paged list,
  // because changing the filter is a fresh query, not a continuation.
  useEffect(() => {
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setItems([])
    setTotal(0)
    setPageNum(0)
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([
      api.listApprovals({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: 0,
        workspace_ids: workspaceFilter,
      }),
      // Run + agent lookups stay broad so the rendered approval rows can
      // resolve names from any workspace the user belongs to (no scope here).
      api.listRuns({ limit: 100 }),
      api.listAgents(),
    ])
      .then(([list, r, a]) => {
        if (cancelled) return
        setItems(list.items)
        setTotal(list.total)
        setRuns(r.items)
        setAgents(a.items)
        // Drop pendingIds whose underlying approval has actually committed
        // server-side — otherwise stale ids would hide rows that are now
        // legitimately part of /approved or /rejected.
        setPendingIds(prev => {
          if (prev.size === 0) return prev
          let changed = false
          const next = new Set(prev)
          for (const item of list.items) {
            if (item.status !== 'pending' && next.has(item.id)) {
              next.delete(item.id)
              changed = true
            }
          }
          return changed ? next : prev
        })
        setError(null)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load approvals')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [statusFilter, reloadTick, workspaceFilter])

  // Append the next page. Guarded so concurrent triggers (scroll + ad-hoc
  // calls) don't fire two parallel requests. Mirrors RunsScreen / sandbox.
  const loadMore = async () => {
    if (loadingMore || loading) return
    if (items.length >= total) return
    setLoadingMore(true)
    const nextPage = pageNum + 1
    try {
      const list = await api.listApprovals({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
        workspace_ids: workspaceFilter,
      })
      setItems(prev => [...prev, ...list.items])
      setPageNum(nextPage)
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

  // run_id → agent_id → agent.name. Lets us name the agent that triggered
  // each approval without an N+1 fetch.
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

  // run_id → agent_id, used by the WorkspaceContextPill to resolve which
  // workspace the approval's agent belongs to.
  const agentIdByRun = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of runs) {
      if (r.agent_id) m.set(r.id, r.agent_id)
    }
    return m
  }, [runs])

  // Rows hidden during the 5s undo window are filtered out of the visible
  // list and out of filter-chip counts — both should stay in sync. Sandbox
  // does the same. Counts are approximate ("what's been loaded so far") —
  // they don't reflect server total because that would require N round
  // trips just to get a chip badge.
  const visible = useMemo(
    () => items.filter(a => !pendingIds.has(a.id)),
    [items, pendingIds],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visible.length }
    visible.forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [visible])

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'approvals' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="APPROVALS"
          title={<>Pending <em>approvals.</em></>}
          subtitle="Actions your agents want to take that need your approval."
        />

        <PolicyBanner />

        <Flex direction="column" gap="2" mb="4">
          <WorkspaceFilter />
          <Flex align="center" gap="2" wrap="wrap" data-tour="approvals-filter">
            <Caption mr="1">status</Caption>
            {APPROVAL_STATUS_FILTERS.map(f => {
              const isActive = statusFilter === f
              const activeColor = f === 'pending' ? 'orange' : 'cyan'
              return (
                <Button
                  key={f}
                  type="button"
                  size="2"
                  variant="soft"
                  color={isActive ? activeColor : 'gray'}
                  onClick={() => setStatusFilter(f)}
                >
                  <span style={{ textTransform: 'capitalize' }}>{f}</span>
                  <Code variant="ghost" size="1" color="gray">{counts[f] ?? 0}</Code>
                </Button>
              )
            })}
            <Box flexGrow="1" />
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </Flex>
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
                ? 'Nothing is waiting for your decision. We\'ll show requests here when an agent wants to do something that needs your sign-off.'
                : 'Switch the filter to Pending to see what\'s waiting on you right now.'
            }
          />
        ) : viewMode === 'table' ? (
          <div className="card card--flush">
            <Flex direction="column">
              {visible.map(a => {
                const agentName = agentNameByRun.get(a.run_id) ?? 'Agent'
                const actionVerb = prettifyRequestedAction(a.requested_action).toLowerCase()
                const isPending = a.status === 'pending'
                const isRejectExpanded = rejectTarget?.approval.id === a.id
                const goToDetail = () => navigate(`/approvals/${a.id}`)
                return (
                  <div key={a.id} className="approval-row-wrap">
                    <div
                      role="link"
                      tabIndex={0}
                      data-tour="approval-row"
                      className="agent-row"
                      onClick={goToDetail}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          goToDetail()
                        }
                      }}
                      style={{
                        gridTemplateColumns: 'auto minmax(0, 1fr) 100px 110px 80px 24px',
                        gap: '14px',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: isRejectExpanded ? 'var(--red-a2)' : undefined,
                      }}
                    >
                      <Avatar
                        initials={agentName.slice(0, 2).toUpperCase()}
                        size={32}
                      />
                      <Box minWidth="0">
                        <Flex align="center" gap="2" wrap="wrap">
                          <Text as="div" size="2" weight="medium" className="truncate">
                            {agentName}
                            <Text as="span" size="2" color="gray">
                              {' '}wants to{' '}
                            </Text>
                            <Text as="span" size="2" className="truncate">
                              {actionVerb}
                            </Text>
                          </Text>
                          <WorkspaceContextPill agentId={agentIdByRun.get(a.run_id)} show={shouldShowWorkspacePill(workspaceFilter, myWorkspaces.length)} />
                        </Flex>
                        {a.requested_by_name && (
                          <Text as="div" size="1" color="gray" mt="1">
                            Triggered by {a.requested_by_name}
                          </Text>
                        )}
                      </Box>
                      <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>
                        {ago(a.created_at)}
                      </Text>
                      <Status status={a.status} />
                      {isPending ? (
                        <Flex gap="2" justify="end">
                          <IconButton
                            size="2"
                            variant="soft"
                            color="jade"
                            title="Quick approve"
                            aria-label={`Approve — ${agentName} ${actionVerb}`}
                            onClick={e => {
                              e.stopPropagation()
                              handleApprove(a, agentName, actionVerb)
                            }}
                          >
                            <IconCheck className="ic ic--sm" />
                          </IconButton>
                          <IconButton
                            size="2"
                            variant="soft"
                            color="red"
                            title="Quick reject"
                            aria-label={`Reject — ${agentName} ${actionVerb}`}
                            onClick={e => {
                              e.stopPropagation()
                              handleRejectStart(a, agentName, actionVerb)
                            }}
                          >
                            <IconX className="ic ic--sm" />
                          </IconButton>
                        </Flex>
                      ) : (
                        <Box />
                      )}
                      <IconArrowRight className="ic" />
                    </div>
                    {isRejectExpanded && (
                      <div className="approval-row__reject-panel">
                        <RejectInlineForm
                          reason={rejectReason}
                          touched={rejectTouched}
                          minChars={REJECT_REASON_MIN}
                          onChangeReason={v => { setRejectReason(v); setRejectTouched(true) }}
                          onBlurReason={() => setRejectTouched(true)}
                          onCancel={closeReject}
                          onConfirm={confirmReject}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </Flex>
          </div>
        ) : (
          <>
            <Grid
              columns={{ initial: '1', sm: '2', lg: '3' }}
              gap="3"
              data-tour="approvals-card-grid"
            >
              {visible.map(a => {
                const agentName = agentNameByRun.get(a.run_id) ?? 'Agent'
                const agentId = agentIdByRun.get(a.run_id) ?? null
                const actionVerb = prettifyRequestedAction(a.requested_action).toLowerCase()
                return (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    agentName={agentName}
                    agentId={agentId}
                    showWorkspacePill={shouldShowWorkspacePill(workspaceFilter, myWorkspaces.length)}
                    actionVerb={actionVerb}
                    isRejectExpanded={rejectTarget?.approval.id === a.id}
                    rejectReason={rejectReason}
                    rejectTouched={rejectTouched}
                    rejectMinChars={REJECT_REASON_MIN}
                    onOpenDetail={() => navigate(`/approvals/${a.id}`)}
                    onApprove={() => handleApprove(a, agentName, actionVerb)}
                    onRejectStart={() => handleRejectStart(a, agentName, actionVerb)}
                    onChangeReason={v => { setRejectReason(v); setRejectTouched(true) }}
                    onBlurReason={() => setRejectTouched(true)}
                    onRejectCancel={closeReject}
                    onRejectConfirm={confirmReject}
                  />
                )
              })}
            </Grid>
          </>
        )}

        {/* Infinite scroll sentinel + completion footer. Mounts once for
            both modes, just below the rendered list. The IntersectionObserver
            useEffect above watches sentinelRef and fires loadMore() when it
            enters the viewport (200px pre-load margin). */}
        {!error && !loading && visible.length > 0 && (
          items.length < total ? (
            <Box ref={sentinelRef} mt="4" py="4" style={{ textAlign: 'center' }}>
              {loadingMore ? (
                <Text size="2" color="gray">Loading more…</Text>
              ) : (
                <Text size="2" color="gray">
                  Scroll for more · {items.length} of {total}
                </Text>
              )}
            </Box>
          ) : (
            <Box mt="4" py="4" style={{ textAlign: 'center' }}>
              <Text size="2" color="gray">
                All caught up · {total} {total === 1 ? 'approval' : 'approvals'}
              </Text>
            </Box>
          )
        )}

      </div>

      <ToastStack toasts={toasts} onUndo={undoToast} onDismiss={dismissToast} />
    </AppShell>
  )
}

function PolicyBanner() {
  return (
    <Box mb="4">
      <Banner tone="info" title="Approval is your call, not the agent's" icon={<IconApproval className="ic" />}>
        An approval request appears whenever a permission or rule says a human has to decide. Your agents can't bypass it — every important action goes to you.
      </Banner>
    </Box>
  )
}

// Segmented switch for the cards / table view choice. Active segment
// gets the indicator slide animation and bolder weight; inactive segment
// stays muted. Choice persists in localStorage (handled by the parent).
// Radix's SegmentedControl already guards against deselect, so we don't
// need to validate the incoming value.
function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ApprovalsViewMode
  onChange: (mode: ApprovalsViewMode) => void
}) {
  return (
    <SegmentedControl.Root
      size="2"
      value={viewMode}
      onValueChange={v => onChange(v as ApprovalsViewMode)}
      aria-label="Approvals view mode"
    >
      <SegmentedControl.Item
        value="cards"
        title="Cards view"
        aria-label="Show approvals as cards"
      >
        <Icon icon={GridViewIcon} />
      </SegmentedControl.Item>
      <SegmentedControl.Item
        value="table"
        title="Table view"
        aria-label="Show approvals as a table"
      >
        <Icon icon={Menu01Icon} />
      </SegmentedControl.Item>
    </SegmentedControl.Root>
  )
}
