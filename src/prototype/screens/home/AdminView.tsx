import { Badge, Box, Button, Flex, Grid, Text } from '@radix-ui/themes'
import { Link } from '../../router'
import { MetricCard } from '../../components/common'
import { statusLabel } from '../../components/common/status-label'
import {
  IconAgent,
  IconApproval,
  IconArrowRight,
  IconRun,
  IconSpend,
} from '../../components/icons'
import type { Agent, ApprovalRequest, RunListItem, RunStatus, SpendDashboard } from '../../lib/types'
import { ago, approverRoleLabel, money, num, prettifyRequestedAction } from '../../lib/format'
import { SpendByAgentCard } from './SpendByAgentCard'
// Hidden 2026-05-01 — purely synthesized surfaces. Restore when backend
// supplies the underlying real data (per-hour run buckets / time-saved metric).
// import { ActivityHeatmap } from './ActivityHeatmap'
// import { SavingsBanner } from './SavingsBanner'

const STATUS_TONE: Record<RunStatus, string> = {
  completed: 'var(--jade-9)',
  completed_with_errors: 'var(--orange-9)',
  failed: 'var(--red-9)',
  suspended: 'var(--orange-9)',
  running: 'var(--cyan-9)',
  pending: 'var(--cyan-9)',
  cancelled: 'var(--gray-9)',
}

export function AdminView({
  agents, activeAgents, pendingApprovals, recentRuns, spend,
}: {
  agents: Agent[]
  activeAgents: Agent[]
  pendingApprovals: ApprovalRequest[]
  recentRuns: RunListItem[]
  spend: SpendDashboard
}) {
  const agentName = (id: string | null) =>
    (id && agents.find(a => a.id === id)?.name) || 'Agent'
  return (
    <>
      <Grid columns="3" gap="4" mb="5">
        <MetricCard
          label="Active agents"
          value={num(activeAgents.length)}
          delta={`${agents.length} total`}
          href="/agents"
          icon={<IconAgent />}
        />
        <MetricCard
          label="Pending approvals"
          value={num(pendingApprovals.length)}
          delta={pendingApprovals.length > 0 ? 'needs a human decision' : 'queue clear'}
          href="/approvals"
          icon={<IconApproval />}
          tone={pendingApprovals.length > 0 ? 'warn' : undefined}
        />
        <MetricCard
          label="Spend · 7d"
          value={money(spend.total_usd, { compact: true })}
          delta={`${spend.items.length} ${spend.group_by}s`}
          href="/costs"
          icon={<IconSpend />}
        />
      </Grid>

      <Grid columns={{ initial: '1', lg: '1fr 1fr' }} gap="4" mb="5">
        <div className="card card--flush" style={{ borderColor: pendingApprovals.length > 0 ? 'var(--orange-a6)' : undefined }}>
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">
              <IconApproval className="ic" />
              Pending approvals
            </Text>
            <Badge color={pendingApprovals.length > 0 ? 'orange' : 'gray'} variant={pendingApprovals.length > 0 ? 'soft' : 'outline'} radius="full" size="1">{pendingApprovals.length}</Badge>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="card__body">
              <Text as="div" size="2" color="gray" style={{ padding: '14px 0' }}>
                Queue is clear.
              </Text>
            </div>
          ) : (
            <div className="card__body"><Flex direction="column" gap="2">
              {pendingApprovals.slice(0, 4).map(a => (
                <Link key={a.id} to={`/approvals/${a.id}`} className="card card--tile">
                  <div style={{ padding: '10px 28px 10px 12px' }}>
                    <Flex align="center" justify="between" gap="3" mb="1">
                      <Text size="1" weight="medium" className="truncate" style={{ minWidth: 0 }}>
                        {prettifyRequestedAction(a.requested_action)}
                      </Text>
                      <Badge color="gray" variant="soft" radius="full" size="1">{a.approver_role ? approverRoleLabel(a.approver_role) : '—'}</Badge>
                    </Flex>
                    <Text as="div" size="1" color="gray">
                      {a.requested_by_name ?? '—'} · {ago(a.created_at)}
                    </Text>
                  </div>
                  <IconArrowRight className="ic ic--sm card--tile__arrow" />
                </Link>
              ))}
              <Button asChild variant="ghost" color='gray' size="1" style={{ margin: 0 }}><a href="#/approvals">Open queue</a></Button>
            </Flex></div>
          )}
        </div>

        <div className="card card--flush">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">
              <IconRun className="ic" />
              Recent activity
            </Text>
            <Button asChild variant="ghost" color='gray' size="1">
              <a href="#/activity"><IconArrowRight className="ic ic--sm" />All activity</a>
            </Button>
          </div>
          {recentRuns.length === 0 ? (
            <div className="card__body">
              <Text as="div" size="2" color="gray" style={{ padding: '14px 0' }}>
                No activity yet. Your agents haven't run anything.
              </Text>
            </div>
          ) : (
            <div className="card__body"><Flex direction="column" gap="2">
              {recentRuns.map(r => (
                <Link key={r.id} to={`/activity/${r.id}`} className="card card--tile card--hover">
                  <div style={{ padding: '10px 28px 10px 12px' }}>
                    <Flex align="center" gap="2" mb="1">
                      <Box
                        aria-hidden
                        style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: STATUS_TONE[r.status] ?? 'var(--gray-9)',
                          flexShrink: 0,
                        }}
                      />
                      <Text size="1" weight="medium" className="truncate" style={{ minWidth: 0 }}>
                        {agentName(r.agent_id)}
                      </Text>
                      <Text size="1" color="gray" className="truncate">
                        · {statusLabel(r.status)}
                      </Text>
                    </Flex>
                    <Text as="div" size="1" color="gray">
                      {ago(r.created_at)}
                      {r.total_cost_usd > 0 && ` · ${money(r.total_cost_usd, { cents: r.total_cost_usd < 100 })}`}
                    </Text>
                  </div>
                  <IconArrowRight className="ic ic--sm card--tile__arrow" />
                </Link>
              ))}
            </Flex></div>
          )}
        </div>
      </Grid>

      <SpendByAgentCard spend={spend} />
    </>
  )
}
