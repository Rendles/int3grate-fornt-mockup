import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Flex, Text, TextField } from '@radix-ui/themes'

import { Avatar, Caption, MockBadge } from '../../components/common'
import { SelectField, TextInput } from '../../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../../components/states'
import { IconSearch } from '../../components/icons'
import { api } from '../../lib/api'
import { ago, roleLabel } from '../../lib/format'
import type { Role, User, Workspace } from '../../lib/types'

// Members tab — tenant-wide user roster. Backend exposes GET /users (paginated)
// as of gateway 0.3.0; admin / domain_admin only. CompanyScreen handles the
// role gate before we get here. No invite / remove / edit-role — backend has
// no user CRUD yet.

const TABLE_COLS = 'minmax(200px, 1.6fr) minmax(180px, 1.4fr) 130px 90px minmax(140px, 1fr) 110px'

const ROLE_SORT: Record<Role, number> = {
  admin: 0,
  domain_admin: 1,
  member: 2,
}

function roleBadgeColor(role: Role): 'violet' | 'cyan' | 'gray' {
  if (role === 'admin') return 'violet'
  if (role === 'domain_admin') return 'cyan'
  return 'gray'
}

export default function MembersTab() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    Promise.all([api.listUsers({ limit: 200 }), api.listAllWorkspaces()])
      .then(([userList, ws]) => {
        if (cancelled) return
        setUsers(userList.items)
        setWorkspaces(ws)
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load members') })
    return () => { cancelled = true }
  }, [])

  const workspaceById = useMemo(() => {
    const m: Record<string, Workspace> = {}
    workspaces.forEach(w => { m[w.id] = w })
    return m
  }, [workspaces])

  const filtered = useMemo(() => {
    if (!users) return null
    const q = query.trim().toLowerCase()
    return users
      .filter(u => {
        if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
        if (roleFilter !== 'all' && u.role !== roleFilter) return false
        if (workspaceFilter !== 'all') {
          if (workspaceFilter === 'none' && u.domain_id != null) return false
          if (workspaceFilter !== 'none' && u.domain_id !== workspaceFilter) return false
        }
        return true
      })
      .sort((a, b) => {
        const r = ROLE_SORT[a.role] - ROLE_SORT[b.role]
        if (r !== 0) return r
        return a.name.localeCompare(b.name)
      })
  }, [users, query, roleFilter, workspaceFilter])

  const roleOptions = [
    { value: 'all', label: 'All roles' },
    { value: 'admin', label: roleLabel('admin') },
    { value: 'domain_admin', label: roleLabel('domain_admin') },
    { value: 'member', label: roleLabel('member') },
  ]

  const workspaceOptions = [
    { value: 'all', label: 'All workspaces' },
    { value: 'none', label: 'Tenant-wide (no workspace)' },
    ...workspaces.map(w => ({ value: w.id, label: w.name })),
  ]

  if (error) {
    return (
      <ErrorState
        title="Couldn't load members"
        body={error}
        onRetry={() => {
          setError(null)
          setUsers(null)
          Promise.all([api.listUsers({ limit: 200 }), api.listAllWorkspaces()])
            .then(([userList, ws]) => {
              setUsers(userList.items)
              setWorkspaces(ws)
            })
            .catch(err => setError(err.message || 'Failed to load members'))
        }}
      />
    )
  }

  return (
    <Box>
      <Box mb="3">
        <Text as="p" size="2" color="gray" style={{ maxWidth: 640, lineHeight: 1.55 }}>
          Everyone in your tenant. Use filters to scope by role or workspace.
        </Text>
      </Box>

      <Flex mb="4" justify="between" align="center" gap="3" wrap="wrap">
        <MockBadge
          kind="design"
          hint="Read-only — invite, remove, and role-edit flows arrive when the backend ships user CRUD endpoints. For now the data is real (GET /users) but the actions aren't."
        />
        <Flex gap="2" align="center" wrap="wrap">
          <Box width="160px">
            <SelectField
              size="2"
              value={roleFilter}
              onChange={v => setRoleFilter(v as 'all' | Role)}
              options={roleOptions}
            />
          </Box>
          <Box width="220px">
            <SelectField
              size="2"
              value={workspaceFilter}
              onChange={setWorkspaceFilter}
              options={workspaceOptions}
            />
          </Box>
          <Box width="240px">
            <TextInput
              size="2"
              placeholder="Search name or email..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            >
              <TextField.Slot side="left">
                <IconSearch className="ic ic--sm" />
              </TextField.Slot>
            </TextInput>
          </Box>
        </Flex>
      </Flex>

      {!filtered ? (
        <LoadingList rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={users && users.length === 0 ? 'No members yet' : 'No members match these filters'}
          body={users && users.length === 0
            ? 'Members will appear here once your tenant has people.'
            : 'Try clearing the search or changing role / workspace.'}
        />
      ) : (
        <div className="card card--table">
          <div className="table-head" style={{ gridTemplateColumns: TABLE_COLS }}>
            <Text as="span" size="1" color="gray">name</Text>
            <Text as="span" size="1" color="gray">email</Text>
            <Text as="span" size="1" color="gray">role</Text>
            <Text as="span" size="1" color="gray">approval</Text>
            <Text as="span" size="1" color="gray">workspace</Text>
            <Text as="span" size="1" color="gray">joined</Text>
          </div>
          {filtered.map(u => {
            const ws = u.domain_id ? workspaceById[u.domain_id] : null
            return (
              <div
                key={u.id}
                className="agent-row"
                style={{ gridTemplateColumns: TABLE_COLS, cursor: 'default' }}
              >
                <Flex align="center" gap="3" minWidth="0">
                  <Avatar initials={u.name.slice(0, 2).toUpperCase()} size={28} />
                  <Text as="span" size="2" weight="medium" className="truncate">{u.name}</Text>
                </Flex>
                <Text as="span" size="2" color="gray" className="truncate">{u.email}</Text>
                <Box>
                  <Badge color={roleBadgeColor(u.role)} variant="soft" radius="full" size="1">
                    {roleLabel(u.role)}
                  </Badge>
                </Box>
                <Text as="span" size="2" color="gray">
                  {u.approval_level != null ? `L${u.approval_level}` : '—'}
                </Text>
                <Box minWidth="0">
                  {ws ? (
                    <Text as="span" size="2" className="truncate">{ws.name}</Text>
                  ) : (
                    <Caption>Tenant-wide</Caption>
                  )}
                </Box>
                <Text as="span" size="1" color="gray">{ago(u.created_at)}</Text>
              </div>
            )
          })}
        </div>
      )}
    </Box>
  )
}
