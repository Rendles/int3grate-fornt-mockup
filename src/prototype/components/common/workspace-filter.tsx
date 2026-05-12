import { Badge, Flex, Text } from '@radix-ui/themes'

import { useAuth } from '../../auth'
import { useScopeFilter } from '../../lib/scope-filter'

// Global scope-filter chip row. Renders on every list screen
// (/agents, /activity, /approvals, /costs) and reads/writes a single
// shared filter through useScopeFilter — there is no per-screen state.
//
// Semantics (see docs/plans/workspaces-redesign-spec.md § 4):
//   filter === []     → "All workspaces" — union of memberships.
//                       The first chip is highlighted, all others off.
//   filter === [id..] → explicit subset; per-workspace chips highlight.
//
// Hidden when the user has 0 or 1 memberships (nothing to filter).
//
// Sticky-last: when exactly one workspace chip is selected, clicking
// it again is a silent no-op. Otherwise the user would land on `[]`,
// which means "all workspaces" — not what they intended. To clear,
// they must click the "All workspaces" chip explicitly.

export function WorkspaceFilter() {
  const { myWorkspaces } = useAuth()
  const { filter, setFilter } = useScopeFilter()
  if (myWorkspaces.length < 2) return null

  const isAllSelected = filter.length === 0

  const onSelectAll = () => {
    if (!isAllSelected) setFilter([])
  }
  const onToggleOne = (id: string) => {
    if (isAllSelected) {
      // Switching from "All" to a single workspace.
      setFilter([id])
      return
    }
    if (filter.includes(id)) {
      // Sticky last — see header comment.
      if (filter.length <= 1) return
      setFilter(filter.filter(x => x !== id))
    } else {
      setFilter([...filter, id])
    }
  }

  return (
    <Flex align="center" gap="2" wrap="wrap">
      <Text size="1" color="gray">Showing:</Text>
      <FilterChip active={isAllSelected} onClick={onSelectAll}>All workspaces</FilterChip>
      {myWorkspaces.map(ws => (
        <FilterChip
          key={ws.id}
          active={!isAllSelected && filter.includes(ws.id)}
          onClick={() => onToggleOne(ws.id)}
        >
          {ws.name}
        </FilterChip>
      ))}
    </Flex>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <Badge
        size="2"
        radius="full"
        variant={active ? 'soft' : 'outline'}
        color={active ? 'cyan' : 'gray'}
      >
        {children}
      </Badge>
    </button>
  )
}
