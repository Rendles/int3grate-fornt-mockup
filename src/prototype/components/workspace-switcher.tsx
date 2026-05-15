import { useMemo, useState } from 'react'
import { DropdownMenu, Flex, Text, TextField } from '@radix-ui/themes'

import { useAuth } from '../auth'
import { api } from '../lib/api'
import { WORKSPACE_SEARCH_THRESHOLD } from '../lib/scope-filter'
import { useRouter } from '../router'
import { MockBadge } from './common'
import { IconCheck, IconPlus, IconSearch, IconSettings } from './icons'
import { WorkspaceFormDialog, type WorkspaceFormValues } from './workspace-form-dialog'

// Sidebar header switcher between workspaces. Single-active model: the
// switcher picks "where I'm working today" — drives hire / create flows
// and Team Map context. It does NOT define what list screens show —
// that's the global scope filter (chip row on each list page), an
// independent state slice. Switching active never touches the filter
// and vice versa. See docs/plans/workspaces-redesign-spec.md § 2-3.

export function WorkspaceSwitcher() {
  const {
    myWorkspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    refreshWorkspaces,
    workspacesLoading,
    user,
  } = useAuth()
  const { navigate } = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')

  const showSearch = myWorkspaces.length >= WORKSPACE_SEARCH_THRESHOLD
  const filteredWorkspaces = useMemo(() => {
    if (!showSearch) return myWorkspaces
    const q = search.trim().toLowerCase()
    if (!q) return myWorkspaces
    return myWorkspaces.filter(w => w.name.toLowerCase().includes(q))
  }, [myWorkspaces, search, showSearch])

  if (!user) return null

  const current = myWorkspaces.find(w => w.id === activeWorkspaceId) ?? null

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
    setActiveWorkspace(ws.id)
  }

  return (
    <>
      <DropdownMenu.Root onOpenChange={open => { if (!open) setSearch('') }}>
        <DropdownMenu.Trigger>
          <button type="button" className="sb__ws sb__ws-trigger" aria-label="Switch workspace">
            <Flex direction="column" align="start" minWidth="0" flexGrow="1">
              <Text as="span" size="1" color="gray" className="truncate">
                Working in
              </Text>
              <Text as="span" size="2" weight="medium" className="truncate">
                {current?.name ?? 'Select workspace'}
              </Text>
            </Flex>
            <DropdownMenu.TriggerIcon />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content align="start" sideOffset={6} variant="soft" className="sb__ws-menu">
          <DropdownMenu.Label>My workspaces</DropdownMenu.Label>
          {showSearch && (
            <Flex px="2" pb="1">
              <TextField.Root
                size="1"
                placeholder="Search workspaces…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%' }}
                // Keep focus inside the field; Radix DropdownMenu's
                // typeahead would otherwise steal keystrokes.
                onKeyDown={e => e.stopPropagation()}
              >
                <TextField.Slot>
                  <IconSearch className="ic ic--sm" />
                </TextField.Slot>
              </TextField.Root>
            </Flex>
          )}
          {filteredWorkspaces.map(ws => {
            const isActive = ws.id === activeWorkspaceId
            return (
              <DropdownMenu.Item
                key={ws.id}
                onSelect={() => { if (!isActive) setActiveWorkspace(ws.id) }}
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
          {showSearch && filteredWorkspaces.length === 0 && (
            <Flex px="3" py="2">
              <Text size="1" color="gray">No matches</Text>
            </Flex>
          )}
          <Flex px="3" pt="2" pb="1">
            <Text size="1" color="gray">
              New agents will be hired into the selected workspace.
            </Text>
          </Flex>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => setCreateOpen(true)}>
            <Flex align="center" gap="2" width="100%">
              <IconPlus size={12} />
              <Text as="span" size="2">Create workspace</Text>
            </Flex>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => navigate('/company')}>
            <Flex align="center" gap="2" width="100%">
              <IconSettings size={12} />
              <Text as="span" size="2">Manage company</Text>
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
