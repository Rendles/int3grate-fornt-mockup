import { Badge, Box, Button, Flex, Grid, Text } from '@radix-ui/themes'
import { Link } from '../../router'
import { MetricCard, Status } from '../../components/common'
import {
  IconAgent,
  IconApproval,
  IconArrowRight,
  IconSpend,
  IconTask,
} from '../../components/icons'
import type { Agent, ApprovalRequest, SpendDashboard, Task } from '../../lib/types'
import { ago, money, num } from '../../lib/format'
import { SpendByAgentCard } from './SpendByAgentCard'
import { TaskOutcomesCard } from './TaskOutcomesCard'
import { ActivityHeatmap } from './ActivityHeatmap'
import { SavingsBanner } from './SavingsBanner'

export function AdminView({
  agents, activeAgents, tasks, failedTasks, pendingApprovals, recentTasks, spend,
}: {
  agents: Agent[]
  activeAgents: Agent[]
  tasks: Task[]
  failedTasks: Task[]
  pendingApprovals: ApprovalRequest[]
  recentTasks: Task[]
  spend: SpendDashboard
}) {
  const agentName = (id: string | null) =>
    (id && agents.find(a => a.id === id)?.name) || '—'
  return (
    <>
      <Grid columns="4" gap="4" mb="5">
        <MetricCard
          label="Active agents"
          value={num(activeAgents.length)}
          delta={`${agents.length} total`}
          href="/agents"
          icon={<IconAgent />}
        />
        <MetricCard
          label="Tasks"
          value={num(tasks.length)}
          delta={`${failedTasks.length} failed`}
          href="/tasks"
          icon={<IconTask />}
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
          href="/spend"
          icon={<IconSpend />}
        />
      </Grid>

      <Grid columns={{ initial: '1', lg: '1fr 2fr' }} gap="4" mb="5">
        <div className="card card--flush" style={{ borderColor: pendingApprovals.length > 0 ? 'var(--amber-a6)' : undefined }}>
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">
              <IconApproval className="ic" />
              Pending approvals
            </Text>
            <Badge color={pendingApprovals.length > 0 ? 'amber' : 'gray'} variant={pendingApprovals.length > 0 ? 'soft' : 'outline'} radius="full" size="1">{pendingApprovals.length}</Badge>
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
                        {a.requested_action}
                      </Text>
                      <Badge color="gray" variant="soft" radius="full" size="1">{a.approver_role ?? '—'}</Badge>
                    </Flex>
                    <Text as="div" size="1" color="gray">
                      {a.requested_by_name ?? a.requested_by ?? '—'} · {ago(a.created_at)}
                    </Text>
                  </div>
                  <IconArrowRight className="ic ic--sm card--tile__arrow" />
                </Link>
              ))}
              <Button asChild variant="ghost" color='gray' size="1"><a href="#/approvals">Open queue</a></Button>
            </Flex></div>
          )}
        </div>

        <div className="card card--flush">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">
              <IconTask className="ic" />
              Recent tasks
            </Text>
            <Button asChild variant="ghost" color='gray' size="1">
              <a href="#/tasks"><IconArrowRight className="ic ic--sm" />All tasks</a>
            </Button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="card__body">
              <Text as="div" size="2" color="gray" align="center" style={{ padding: '30px 0' }}>
                No tasks yet. <Link to="/tasks/new"><Text color="blue">Dispatch a task →</Text></Link>
              </Text>
            </div>
          ) : (
            <div>
              {recentTasks.map(t => (
                <Link
                  key={t.id}
                  to={`/tasks/${t.id}`}
                  className="agent-row"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 130px 80px 20px' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Text as="div" size="2" className="truncate">
                      {t.title ?? <Text color="gray">untitled</Text>}
                    </Text>
                    <Text as="div" size="1" color="gray" mt="1">
                      {ago(t.updated_at)}
                    </Text>
                  </div>
                  <Status status={t.status} />
                  <Text as="div" size="1" color="gray" className="truncate">
                    {agentName(t.assigned_agent_id)}
                  </Text>
                  <Badge color="gray" variant="soft" radius="full" size="1">{t.type.replace('_', ' ')}</Badge>
                  <IconArrowRight className="ic" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </Grid>

      <Grid columns={{ initial: '1', lg: '2fr 2fr 1fr' }} gap="4" mb="5">
        <SpendByAgentCard spend={spend} />
        <ActivityHeatmap />
        <TaskOutcomesCard tasks={tasks} />
      </Grid>

      <Box>
        <SavingsBanner />
      </Box>
    </>
  )
}
