import '@radix-ui/themes/styles.css'
import './prototype.css'
import { Text, Theme as RadixTheme, ThemePanel } from '@radix-ui/themes'
import { AuthProvider, useAuth } from './auth'
import { RouterProvider, matchRoute, useRouter } from './router'
import { ThemeProvider, useTheme } from './theme'
import LoginScreen from './screens/LoginScreen'
import RegisterScreen from './screens/RegisterScreen'
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
import ToolsScreen from './screens/ToolsScreen'
import SpendScreen from './screens/SpendScreen'
import ProfileScreen from './screens/ProfileScreen'
import NotFoundScreen from './screens/NotFoundScreen'
import StyleGuideScreen from './screens/StyleGuideScreen'

function Router() {
  const { user, loading } = useAuth()
  const { path } = useRouter()

  if (loading) {
    return (
      <div className="prototype-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100svh' }}>
        <Text size="1" color="gray" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          connecting …
        </Text>
      </div>
    )
  }

  if (path === '/register') {
    return <RegisterScreen />
  }

  if (!user || path === '/login') {
    return <LoginScreen />
  }

  const routes: { pattern: string; render: (p: Record<string, string>) => React.ReactNode }[] = [
    { pattern: '/', render: () => <HomeScreen /> },
    { pattern: '/agents', render: () => <AgentsScreen /> },
    { pattern: '/agents/new', render: () => <AgentNewScreen /> },
    { pattern: '/agents/:agentId', render: p => <AgentDetailScreen agentId={p.agentId} tab="overview" /> },
    { pattern: '/agents/:agentId/versions/new', render: p => <VersionNewScreen agentId={p.agentId} /> },
    { pattern: '/agents/:agentId/grants', render: p => <AgentDetailScreen agentId={p.agentId} tab="grants" /> },
    { pattern: '/agents/:agentId/settings', render: p => <AgentDetailScreen agentId={p.agentId} tab="settings" /> },
    { pattern: '/tasks', render: () => <TasksScreen /> },
    { pattern: '/tasks/new', render: () => <TaskNewScreen /> },
    { pattern: '/tasks/:taskId', render: p => <TaskDetailScreen taskId={p.taskId} /> },
    { pattern: '/runs/:runId', render: p => <RunDetailScreen runId={p.runId} /> },
    { pattern: '/approvals', render: () => <ApprovalsScreen /> },
    { pattern: '/approvals/:approvalId', render: p => <ApprovalDetailScreen approvalId={p.approvalId} /> },
    { pattern: '/tools', render: () => <ToolsScreen /> },
    { pattern: '/spend', render: () => <SpendScreen /> },
    { pattern: '/profile', render: () => <ProfileScreen /> },
    { pattern: '/components', render: () => <StyleGuideScreen /> },
  ]

  for (const r of routes) {
    const m = matchRoute(r.pattern, path)
    if (m) return r.render(m)
  }

  return <NotFoundScreen />
}

function ThemedRoot() {
  const { theme } = useTheme()
  return (
    <RadixTheme
      asChild
      appearance={theme}
      accentColor='indigo'
      grayColor="slate"
      panelBackground="solid"
      radius="small"
      scaling="90%"
      hasBackground={false}
    >
      <div className="prototype-root">
        <AuthProvider>
          <RouterProvider>
            <Router />
          </RouterProvider>
        </AuthProvider>
        {import.meta.env.DEV && <ThemePanel defaultOpen={true} />}
      </div>
    </RadixTheme>
  )
}

export default function PrototypeApp() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  )
}
