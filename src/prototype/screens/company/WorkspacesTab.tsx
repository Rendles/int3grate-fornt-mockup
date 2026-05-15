import { useEffect, useState } from 'react'
import { Badge, Box, Button, Flex, Text, Tooltip } from '@radix-ui/themes'

import { Avatar, Caption, MockBadge } from '../../components/common'
import { EmptyState, LoadingList } from '../../components/states'
import { IconPlus } from '../../components/icons'
import { WorkspaceDeleteDialog } from '../../components/workspace-delete-dialog'
import { WorkspaceFormDialog, type WorkspaceFormValues } from '../../components/workspace-form-dialog'
import { useAuth } from '../../auth'
import { api } from '../../lib/api'
import { ago, roleLabel } from '../../lib/format'
import type { User, Workspace } from '../../lib/types'

// Workspaces tab content (was WorkspacesScreen.tsx). Cards grid + create /
// edit / delete + active-workspace members card. AppShell + PageHeader live
// on the parent CompanyScreen now.

type Stats = Record<string, { member_count: number; agent_count: number }>

export default function WorkspacesTab() {
  const { user, myWorkspaces, activeWorkspaceId, setActiveWorkspace, refreshWorkspaces, workspacesLoading } = useAuth()

  const [stats, setStats] = useState<Stats | null>(null)
  const [members, setMembers] = useState<User[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Workspace | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)

  useEffect(() => {
    let cancelled = false
    api.listWorkspaceStats().then(s => { if (!cancelled) setStats(s) })
    return () => { cancelled = true }
  }, [myWorkspaces])

  useEffect(() => {
    if (!activeWorkspaceId) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setMembers(null)
      return
    }
    let cancelled = false
    api.listWorkspaceMembers(activeWorkspaceId).then(m => { if (!cancelled) setMembers(m) })
    return () => { cancelled = true }
  }, [activeWorkspaceId])

  if (!user) return null

  const handleCreate = async (values: WorkspaceFormValues) => {
    const ws = await api.createWorkspace(values, user.id)
    await refreshWorkspaces()
    setActiveWorkspace(ws.id)
  }

  const handleEdit = async (values: WorkspaceFormValues) => {
    if (!editTarget) return
    await api.updateWorkspace(editTarget.id, values)
    await refreshWorkspaces()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await api.deleteWorkspace(deleteTarget.id, user.id)
    await refreshWorkspaces()
    setStats(await api.listWorkspaceStats())
  }

  const isOnlyMembership = myWorkspaces.length === 1

  return (
    <Box>
      <Box mb="3">
        <Text as="p" size="2" color="gray" style={{ maxWidth: 640, lineHeight: 1.55 }}>
          Use workspaces to group agents by department, client, location, or business line.
          Examples: Sales, Customer Support, Acme Corp, EU Operations.
        </Text>
      </Box>

      <Flex mb="4" justify="between" align="center" gap="3" wrap="wrap">
        <MockBadge
          kind="design"
          hint="Workspaces are mock-only — no /workspaces endpoints exist in the gateway spec yet. Create / edit / member display all run client-side."
        />
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus />New workspace
        </Button>
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
            const isActive = ws.id === activeWorkspaceId
            const s = stats?.[ws.id]
            return (
              <div key={ws.id} className={`ws-card${isActive ? ' ws-card--active' : ''}`}>
                <Flex direction="column" gap="1" minWidth="0">
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text size="3" weight="medium" className="truncate">{ws.name}</Text>
                    {isActive && <Badge color="cyan" radius="full" size="1">Active</Badge>}
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
                    <Button variant="soft" color="gray" size="1" onClick={() => setActiveWorkspace(ws.id)}>
                      Switch
                    </Button>
                  )}
                  <Button variant="soft" size="1" onClick={() => setEditTarget(ws)}>
                    Edit
                  </Button>
                  {isOnlyMembership ? (
                    <Tooltip content="You can't delete your only workspace.">
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

      {activeWorkspaceId && members && members.length > 0 && (
        <Box mt="6">
          <Flex align="center" gap="2" mb="3">
            <Text size="3" weight="medium">Members of current workspace</Text>
            <MockBadge
              kind="design"
              hint="Read-only — invite and remove flows require user CRUD endpoints, none of which are in the gateway spec yet."
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
    </Box>
  )
}
