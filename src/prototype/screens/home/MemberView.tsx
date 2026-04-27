import { Badge, Button, Flex, Grid, Text } from '@radix-ui/themes'
import { Link } from '../../router'
import { MockBadge, Status } from '../../components/common'
import { IconArrowRight } from '../../components/icons'
import type { Agent, ApprovalRequest, Task } from '../../lib/types'
import { ago } from '../../lib/format'

export function MemberView({
  myTasks, myApprovals, agents,
}: {
  myTasks: Task[]
  myApprovals: ApprovalRequest[]
  agents: Agent[]
}) {
  const agentName = (id: string | null) =>
    (id && agents.find(a => a.id === id)?.name) || '—'
  return (
    <Grid columns={{ initial: '1', lg: '1fr 1fr' }} gap="4">
      <div className="card">
        <div className="card__head">
          <Flex align="center" gap="2">
            <Text as="div" size="2" weight="medium" className="card__title">My tasks</Text>
            <MockBadge kind="deferred" />
          </Flex>
          <Button asChild variant="ghost" size="1"><a href="#/tasks"><IconArrowRight className="ic ic--sm" />All tasks</a></Button>
        </div>
        {myTasks.length === 0 ? (
          <div className="card__body">
            <Text as="div" size="2" color="gray" align="center" style={{ padding: '30px 0' }}>
              You haven't started any tasks. <Link to="/tasks/new"><Text color="blue">Create one →</Text></Link>
            </Text>
          </div>
        ) : (
          <div>
            {myTasks.map(t => (
              <Link key={t.id} to={`/tasks/${t.id}`} className="agent-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 80px 20px' }}>
                <div style={{ minWidth: 0 }}>
                  <Text as="div" size="2" className="truncate">
                    {t.title ?? <Text color="gray">untitled</Text>}
                  </Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {agentName(t.assigned_agent_id)} · {ago(t.updated_at)}
                  </Text>
                </div>
                <Status status={t.status} />
                <Badge color="gray" variant="soft" radius="full" size="1">{t.type.replace('_', ' ')}</Badge>
                <IconArrowRight className="ic" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">My approval requests</Text></div>
        {myApprovals.length === 0 ? (
          <div className="card__body">
            <Text as="div" size="2" color="gray" style={{ padding: '14px 0' }}>
              You haven't triggered any approvals.
            </Text>
          </div>
        ) : (
          <div className="card__body"><Flex direction="column" gap="2">
            {myApprovals.slice(0, 6).map(a => (
              <Link key={a.id} to={`/approvals/${a.id}`} className="card card--tile">
                <div style={{ padding: '10px 28px 10px 12px' }}>
                  <Flex align="center" justify="between" gap="3" mb="1">
                    <Text size="1" weight="medium" className="truncate" style={{ minWidth: 0 }}>{a.requested_action}</Text>
                    <Status status={a.status} />
                  </Flex>
                  <Text as="div" size="1" color="gray" mt="1">
                    {ago(a.created_at)}
                  </Text>
                </div>
                <IconArrowRight className="ic ic--sm card--tile__arrow" />
              </Link>
            ))}
          </Flex></div>
        )}
      </div>
    </Grid>
  )
}
