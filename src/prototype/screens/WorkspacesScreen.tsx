import { useEffect, useState } from 'react'
import { Badge, Box, Button, Flex, Text, Tooltip } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, MockBadge, PageHeader } from '../components/common'
import { EmptyState, LoadingList } from '../components/states'
import { IconPlus } from '../components/icons'
import { WorkspaceDeleteDialog } from '../components/workspace-delete-dialog'
import { WorkspaceFormDialog, type WorkspaceFormValues } from '../components/workspace-form-dialog'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { ago } from '../lib/format'
import { roleLabel } from '../lib/format'
import type { User, Workspace } from '../lib/types'

// /workspaces — list + create + edit. Step 6 of docs/agent-plans/
// 2026-05-06-2200-workspaces-mock.md. Delete arrives in Step 7.
//
// Cards in a grid show emoji + name + description + member/agent counts +
// created-at. Active workspace gets a soft highlight + "Current" badge;
// non-active cards expose a Switch button. Edit reuses WorkspaceFormDialog
// in mode='edit'. Members of the current workspace are listed in a
// read-only card below the grid (full invite/remove flow needs backend
// endpoints that don't exist).

type Stats = Record<string, { member_count: number; agent_count: number }>

export default function WorkspacesScreen() {
  const { user, myWorkspaces, currentWorkspaceId, switchWorkspace, refreshWorkspaces, workspacesLoading } = useAuth()

  const [stats, setStats] = useState<Stats | null>(null)
  const [members, setMembers] = useState<User[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Workspace | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)

  // Stats for every workspace card in the grid.
  useEffect(() => {
    let cancelled = false
    api.listWorkspaceStats().then(s => { if (!cancelled) setStats(s) })
    return () => { cancelled = true }
  }, [myWorkspaces])

  // Members of the current workspace for the read-only roster card.
  useEffect(() => {
    if (!currentWorkspaceId) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setMembers(null)
      return
    }
    let cancelled = false
    api.listWorkspaceMembers(currentWorkspaceId).then(m => { if (!cancelled) setMembers(m) })
    return () => { cancelled = true }
  }, [currentWorkspaceId])

  if (!user) return null

  const handleCreate = async (values: WorkspaceFormValues) => {
    const ws = await api.createWorkspace(values, user.id)
    await refreshWorkspaces()
    switchWorkspace(ws.id)
  }

  const handleEdit = async (values: WorkspaceFormValues) => {
    if (!editTarget) return
    await api.updateWorkspace(editTarget.id, values)
    await refreshWorkspaces()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await api.deleteWorkspace(deleteTarget.id, user.id)
    // refreshWorkspaces drops the now-invalid currentWorkspaceId via
    // applyCurrentWorkspace and falls through to the first remaining
    // workspace (or null). Stats refetch as well — myWorkspaces effect dep.
    await refreshWorkspaces()
    setStats(await api.listWorkspaceStats())
  }

  // Last-workspace block — disable the Delete button (in addition to the
  // server-side throw) so the user understands the constraint up front
  // instead of via an error toast after typing the name.
  const isOnlyMembership = myWorkspaces.length === 1

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'workspaces' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="WORKSPACES"
          title={<>Your <em>workspaces.</em></>}
          subtitle="Teams inside your company. Each holds its own agents, approvals, and spend. Switch context from the sidebar."
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus />New workspace
            </Button>
          }
        />

        <Flex mb="4">
          <MockBadge
            kind="design"
            hint="Workspaces are mock-only — no /workspaces endpoints exist in the gateway spec yet. Create / edit / member display all run client-side."
          />
        </Flex>

        {workspacesLoading && myWorkspaces.length === 0 && <LoadingList rows={3} />}

        {!workspacesLoading && myWorkspaces.length === 0 && (
          <EmptyState
            title="No workspaces yet"
            body="Create one to scope your agents, approvals, and spend by team."
            action={{ label: 'New workspace', onClick: () => setCreateOpen(true) }}
          />
        )}

        {myWorkspaces.length > 0 && (
          <div className="ws-grid">
            {myWorkspaces.map(ws => {
              const isActive = ws.id === currentWorkspaceId
              const s = stats?.[ws.id]
              return (
                <div key={ws.id} className={`ws-card${isActive ? ' ws-card--active' : ''}`}>
                  <Flex direction="column" gap="1" minWidth="0">
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text size="3" weight="medium" className="truncate">{ws.name}</Text>
                      {isActive && <Badge color="blue" radius="full" size="1">Current</Badge>}
                    </Flex>
                    {ws.description && (
                      <Text size="2" color="gray">{ws.description}</Text>
                    )}
                    <Flex gap="3" mt="2" wrap="wrap">
                      <Caption>
                        {s ? `${s.member_count} ${s.member_count === 1 ? 'member' : 'members'}` : '—'}
                      </Caption>
                      <Caption>
                        {s ? `${s.agent_count} ${s.agent_count === 1 ? 'agent' : 'agents'}` : '—'}
                      </Caption>
                      <Caption>created {ago(ws.created_at)}</Caption>
                    </Flex>
                  </Flex>

                  <Flex gap="2" mt="3" justify="end">
                    {!isActive && (
                      <Button variant="soft" color="gray" size="1" onClick={() => switchWorkspace(ws.id)}>
                        Switch
                      </Button>
                    )}
                    <Button variant="soft" size="1" onClick={() => setEditTarget(ws)}>
                      Edit
                    </Button>
                    {isOnlyMembership ? (
                      <Tooltip content="You can't delete your only workspace.">
                        {/* Wrap disabled button so the tooltip still triggers. */}
                        <span>
                          <Button variant="soft" color="red" size="1" disabled>
                            Delete
                          </Button>
                        </span>
                      </Tooltip>
                    ) : (
                      <Button variant="soft" color="red" size="1" onClick={() => setDeleteTarget(ws)}>
                        Delete
                      </Button>
                    )}
                  </Flex>
                </div>
              )
            })}
          </div>
        )}

        {currentWorkspaceId && members && members.length > 0 && (
          <Box mt="6">
            <Flex align="center" gap="2" mb="3">
              <Text size="3" weight="medium">Members</Text>
              <MockBadge
                kind="design"
                hint="Read-only — invite and remove flows require GET /users plus invite endpoints, neither of which is in the gateway spec yet."
              />
            </Flex>
            <div className="ws-members">
              {members.map(m => (
                <Flex key={m.id} align="center" gap="3" className="ws-member">
                  <Avatar initials={m.name.slice(0, 2).toUpperCase()} size={32} />
                  <Flex direction="column" minWidth="0">
                    <Text size="2" weight="medium" className="truncate">{m.name}</Text>
                    <Text size="1" color="gray" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {roleLabel(m.role)}{m.approval_level != null ? ` · L${m.approval_level}` : ''}
                    </Text>
                  </Flex>
                </Flex>
              ))}
            </div>
          </Box>
        )}
      </div>

      <WorkspaceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
      />
      <WorkspaceFormDialog
        open={!!editTarget}
        onOpenChange={open => { if (!open) setEditTarget(null) }}
        mode="edit"
        workspace={editTarget ?? undefined}
        onSubmit={handleEdit}
      />
      <WorkspaceDeleteDialog
        workspace={deleteTarget}
        agentCount={deleteTarget ? (stats?.[deleteTarget.id]?.agent_count ?? 0) : 0}
        memberCount={deleteTarget ? (stats?.[deleteTarget.id]?.member_count ?? 0) : 0}
        onOpenChange={open => { if (!open) setDeleteTarget(null) }}
        onDelete={handleDelete}
      />
    </AppShell>
  )
}
