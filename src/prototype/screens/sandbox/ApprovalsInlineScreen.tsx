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
import { Box, Button, Code, Flex, Grid, Text } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { Caption, MockBadge, PageHeader } from '../../components/common'
import { Banner, EmptyState, ErrorState, LoadingList } from '../../components/states'
import { IconApproval } from '../../components/icons'
import { ApprovalCard } from '../../components/approval-card'
import { ToastStack } from '../../components/undo-toast'
import { makeToastId, nowMs, type UndoToast } from '../../lib/undo-toast'
import { useRouter } from '../../router'
import { api } from '../../lib/api'
import { APPROVAL_STATUS_FILTERS } from '../../lib/filters'
import type { ApprovalStatusFilter } from '../../lib/filters'
import type { Agent, ApprovalRequest, RunListItem } from '../../lib/types'
import { prettifyRequestedAction } from '../../lib/format'

// 12 cards = 4 rows of 3 on lg / 6 rows of 2 on md / 12 on small. Keeps
// the first paint compact and lets the IntersectionObserver fire as soon
// as the user starts scrolling. Mirrors RunsScreen's approach.
const PAGE_SIZE = 12

// 5 seconds — long enough to catch a misclick, short enough that the user
// doesn't expect this to be a real "I changed my mind" workflow.
const UNDO_WINDOW_MS = 5000

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
                    rejectMinChars={4}
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

