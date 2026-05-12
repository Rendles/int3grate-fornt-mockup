import { AppShell } from '../components/shell'
import { Badge, Box, Button, Code, Flex, Grid, Text } from '@radix-ui/themes'

import { Caption, PageHeader, Avatar } from '../components/common'
import { useAuth } from '../auth'
import { roleLabel, absTime, workspaceLabel, tenantLabel } from '../lib/format'

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  if (!user) return null

  const initials = user.name.slice(0, 2).toUpperCase()

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'profile' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow="PROFILE"
          title={<>Hello, <em>{user.name.split(' ')[0]}.</em></>}
          actions={<Button variant="ghost" onClick={logout}>Sign out</Button>}
        />

        <div className="card">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">Identity</Text>
          </div>
          <div className="card__body">
            <Flex align="center" gap="5">
              <Avatar initials={initials} size={64} />
              <Box flexGrow="1">
                <Text as="div" size="5" style={{ letterSpacing: '-0.01em' }}>
                  {user.name}
                </Text>
                <Text as="div" size="1" color="gray" mt="1">{user.email}</Text>
                <Flex align="center" gap="2" mt="2">
                  <Badge color="cyan" variant="soft" radius="full" size="1">{roleLabel(user.role)}</Badge>
                  {user.approval_level != null && (
                    <Badge color="cyan" variant="soft" radius="full" size="1">approval · L{user.approval_level}</Badge>
                  )}
                </Flex>
              </Box>
            </Flex>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Scope</Text></div>
          <div className="card__body">
            <Grid columns="2" gap="4">
              <Box>
                <Caption as="div" mb="1">Tenant</Caption>
                <Text as="div" size="1">{tenantLabel(user.tenant_id)}</Text>
              </Box>
              <Box>
                <Caption as="div" mb="1">Workspace</Caption>
                <Text as="div" size="1">{workspaceLabel(user.domain_id)}</Text>
              </Box>
              <Box>
                <Caption as="div" mb="1">Created</Caption>
                <Text as="div" size="1">{absTime(user.created_at)}</Text>
              </Box>
              <Box>
                <Caption as="div" mb="1">Role</Caption>
                <Text as="div" size="1">{roleLabel(user.role)}</Text>
              </Box>
            </Grid>
          </div>
        </div>

        <div style={{ height: 16 }} />

        {user.approval_level != null && (
          <div className="card">
            <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Approval authority</Text></div>
            <div className="card__body">
              <Text as="p" size="1" color="gray" mb="4">
                Your <Code variant="ghost">approval_level</Code> is <Code variant="ghost">{user.approval_level}</Code>.
                Rules attached to agent versions route requests to whichever level they need.
              </Text>
              <Grid columns="4" gap="2">
                {[1, 2, 3, 4].map(lvl => {
                  const on = (user.approval_level ?? 0) >= lvl
                  return (
                    <Box key={lvl} p="3" style={{
                      border: `1px solid ${on ? 'var(--accent-a7)' : 'var(--gray-7)'}`,
                      borderRadius: 4,
                      background: on ? 'var(--accent-a3)' : 'var(--gray-3)',
                      textAlign: 'center',
                    }}>
                      <Text as="div" size="6" style={{ color: on ? 'var(--accent-9)' : 'var(--gray-10)' }}>L{lvl}</Text>
                      <Text as="div" size="1" color="gray" mt="1" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {on ? 'can decide' : 'above you'}
                      </Text>
                    </Box>
                  )
                })}
              </Grid>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
