import { useEffect } from 'react'
import { Box } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, Tabs } from '../components/common'
import { useAuth } from '../auth'
import { useRouter } from '../router'

import MembersTab from './company/MembersTab'
import WorkspacesTab from './company/WorkspacesTab'

export type CompanyTab = 'members' | 'workspaces'

// /company — single hub for tenant structure. Two tabs:
// - Members: tenant-wide user list (admin / domain_admin only).
// - Workspaces: existing list/create/edit/delete flow.
// Plan: docs/agent-plans/2026-05-14-1500-company-hub-members.md.
export default function CompanyScreen({ tab }: { tab: CompanyTab }) {
  const { user } = useAuth()
  const { navigate } = useRouter()

  // Members tab is admin / domain_admin only — backend GET /users requires
  // those roles. For member, transparently redirect to the Workspaces tab
  // instead of showing a NoAccess pane (no fake-surface principle).
  useEffect(() => {
    if (tab === 'members' && user?.role === 'member') {
      navigate('/company/workspaces', { replace: true })
    }
  }, [tab, user?.role, navigate])

  if (!user) return null
  if (tab === 'members' && user.role === 'member') return null

  const items: { key: CompanyTab; label: string; href: string }[] = []
  if (user.role !== 'member') {
    items.push({ key: 'members', label: 'Members', href: '/company/members' })
  }
  items.push({ key: 'workspaces', label: 'Workspaces', href: '/company/workspaces' })

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'company' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="COMPANY"
          title={<>Your <em>company.</em></>}
          subtitle="People and workspaces in your tenant."
        />

        <Tabs items={items} active={tab} />

        <Box mt="5">
          {tab === 'members' ? <MembersTab /> : <WorkspacesTab />}
        </Box>
      </div>
    </AppShell>
  )
}
