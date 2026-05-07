import { useState } from 'react'
import { DropdownMenu, Flex, Text } from '@radix-ui/themes'

import { useAuth } from '../auth'
import { api } from '../lib/api'
import { useRouter } from '../router'
import { MockBadge } from './common'
import { IconCheck, IconPlus, IconSettings } from './icons'
import { WorkspaceFormDialog, type WorkspaceFormValues } from './workspace-form-dialog'

// Sidebar header switcher between workspaces. Lives between .sb__brand and
// .sb__nav per docs/agent-plans/2026-05-06-2200-workspaces-mock.md § 5.5.
//
// Step 6 scope: radio-list + `+ Create workspace` + `Manage workspaces`
// link to /workspaces (delete arrives in Step 7).
//
// Reads/writes workspace state via useAuth(): myWorkspaces, currentWorkspaceId,
// switchWorkspace, refreshWorkspaces, workspacesLoading. After create the
// new workspace is auto-switched (WorkspaceRemount fires the re-fetch).

export function WorkspaceSwitcher() {
  const { myWorkspaces, currentWorkspaceId, switchWorkspace, refreshWorkspaces, workspacesLoading, user } = useAuth()
  const { navigate } = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  if (!user) return null

  const current = myWorkspaces.find(w => w.id === currentWorkspaceId) ?? null

  // Empty / loading states. Until the user is in at least one workspace, the
  // switcher shows a non-interactive placeholder — no fake button.
  if (workspacesLoading && myWorkspaces.length === 0) {
    return (
      <div className="sb__ws sb__ws--placeholder" aria-hidden>
        <Text size="2" color="gray">Loading…</Text>
      </div>
    )
  }
  if (myWorkspaces.length === 0) {
    return (
      <div className="sb__ws sb__ws--placeholder">
        <Text size="2" color="gray">No workspace</Text>
      </div>
    )
  }

  const handleCreate = async (values: WorkspaceFormValues) => {
    const ws = await api.createWorkspace(values, user.id)
    await refreshWorkspaces()
    switchWorkspace(ws.id)
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <button type="button" className="sb__ws sb__ws-trigger" aria-label="Switch workspace">
            <Flex direction="column" align="start" minWidth="0" flexGrow="1">
              <Text as="span" size="2" weight="medium" className="truncate">
                {current?.name ?? 'Select workspace'}
              </Text>
              <Text as="span" size="1" color="gray" className="truncate" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Workspace
              </Text>
            </Flex>
            <DropdownMenu.TriggerIcon />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content align="start" sideOffset={6} variant="soft" className="sb__ws-menu">
          <DropdownMenu.Label>My workspaces</DropdownMenu.Label>
          {myWorkspaces.map(ws => {
            const isActive = ws.id === currentWorkspaceId
            return (
              <DropdownMenu.Item
                key={ws.id}
                onSelect={() => { if (!isActive) switchWorkspace(ws.id) }}
              >
                <Flex align="center" gap="2" width="100%">
                  <Text as="span" size="2" className="truncate" style={{ flexGrow: 1 }}>
                    {ws.name}
                  </Text>
                  {isActive && <IconCheck size={12} />}
                </Flex>
              </DropdownMenu.Item>
            )
          })}
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => setCreateOpen(true)}>
            <Flex align="center" gap="2" width="100%">
              <IconPlus size={12} />
              <Text as="span" size="2">Create workspace</Text>
            </Flex>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => navigate('/workspaces')}>
            <Flex align="center" gap="2" width="100%">
              <IconSettings size={12} />
              <Text as="span" size="2">Manage workspaces</Text>
            </Flex>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <Flex px="3" py="1" justify="end">
            <MockBadge
              kind="design"
              hint="Workspaces are mock-only — no /workspaces endpoints exist in the gateway spec yet. Switching, creating, deleting are all client-side."
            />
          </Flex>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <WorkspaceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
      />
    </>
  )
}
