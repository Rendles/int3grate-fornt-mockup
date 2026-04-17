import './prototype.css'
import { AuthProvider, useAuth } from './auth'
import { RouterProvider, matchRoute, useRouter } from './router'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import AgentsScreen from './screens/AgentsScreen'
import AgentDetailScreen from './screens/AgentDetailScreen'
import AgentNewScreen from './screens/AgentNewScreen'
import VersionNewScreen from './screens/VersionNewScreen'
import TasksScreen from './screens/TasksScreen'
import TaskNewScreen from './screens/TaskNewScreen'
import TaskDetailScreen from './screens/TaskDetailScreen'
import RunDetailScreen from './screens/RunDetailScreen'
import ApprovalsScreen from './screens/ApprovalsScreen'
import ApprovalDetailScreen from './screens/ApprovalDetailScreen'
import SpendScreen from './screens/SpendScreen'
import ProfileScreen from './screens/ProfileScreen'
import NotFoundScreen from './screens/NotFoundScreen'

function Router() {
  const { user, loading } = useAuth()
  const { path } = useRouter()

  if (loading) {
    return (
      <div className="prototype-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100svh' }}>
        <div className="mono" style={{ color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 11 }}>
          connecting …
        </div>
      </div>
    )
  }

  if (!user || path === '/login') {
    return <LoginScreen />
  }

  const routes: { pattern: string; render: (p: Record<string, string>) => React.ReactNode }[] = [
    { pattern: '/', render: () => <HomeScreen /> },
    { pattern: '/agents', render: () => <AgentsScreen /> },
    { pattern: '/agents/new', render: () => <AgentNewScreen /> },
    { pattern: '/agents/:agentId', render: p => <AgentDetailScreen agentId={p.agentId} tab="overview" /> },
    { pattern: '/agents/:agentId/versions', render: p => <AgentDetailScreen agentId={p.agentId} tab="versions" /> },
    { pattern: '/agents/:agentId/versions/new', render: p => <VersionNewScreen agentId={p.agentId} /> },
    { pattern: '/agents/:agentId/grants', render: p => <AgentDetailScreen agentId={p.agentId} tab="grants" /> },
    { pattern: '/agents/:agentId/settings', render: p => <AgentDetailScreen agentId={p.agentId} tab="settings" /> },
    { pattern: '/tasks', render: () => <TasksScreen /> },
    { pattern: '/tasks/new', render: () => <TaskNewScreen /> },
    { pattern: '/tasks/:taskId', render: p => <TaskDetailScreen taskId={p.taskId} /> },
    { pattern: '/runs/:runId', render: p => <RunDetailScreen runId={p.runId} /> },
    { pattern: '/approvals', render: () => <ApprovalsScreen /> },
    { pattern: '/approvals/:approvalId', render: p => <ApprovalDetailScreen approvalId={p.approvalId} /> },
    { pattern: '/spend', render: () => <SpendScreen /> },
    { pattern: '/profile', render: () => <ProfileScreen /> },
  ]

  for (const r of routes) {
    const m = matchRoute(r.pattern, path)
    if (m) return r.render(m)
  }

  return <NotFoundScreen />
}

export default function PrototypeApp() {
  return (
    <div className="prototype-root">
      <AuthProvider>
        <RouterProvider>
          <Router />
        </RouterProvider>
      </AuthProvider>
    </div>
  )
}
