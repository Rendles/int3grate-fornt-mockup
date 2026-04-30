import '@radix-ui/themes/styles.css'
import './prototype.css'
import { useEffect } from 'react'
import { Text, Theme as RadixTheme, ThemePanel } from '@radix-ui/themes'
import { AuthProvider, useAuth } from './auth'
import { RouterProvider, matchRoute, useRouter } from './router'
import { ThemeProvider, useTheme } from './theme'
import { api } from './lib/api'
import { TourProvider } from './tours/TourProvider'
import { TourOverlay } from './tours/TourOverlay'
import { TrainingModeProvider } from './tours/TrainingModeProvider'
import { TrainingBanner } from './tours/TrainingBanner'
import { TrainingAutoExit } from './tours/TrainingAutoExit'
import { WelcomeToast } from './tours/WelcomeToast'
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
import RunsScreen from './screens/RunsScreen'
import SettingsScreen from './screens/SettingsScreen'
import ChatNewScreen from './screens/ChatNewScreen'
import ApprovalsScreen from './screens/ApprovalsScreen'
import ApprovalDetailScreen from './screens/ApprovalDetailScreen'
import ToolsScreen from './screens/ToolsScreen'
import SpendScreen from './screens/SpendScreen'
import ProfileScreen from './screens/ProfileScreen'
import LearnScreen from './screens/LearnScreen'
import NotFoundScreen from './screens/NotFoundScreen'

// Old paths redirect to new ones (legacy hash routes).
// Kept so existing tour navigateTo, bookmarks, and direct links don't 404.
function Redirect({ to }: { to: string }) {
  const { navigate } = useRouter()
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to, navigate])
  return null
}

// Async redirect for legacy /chats/:id deep-links — chat lives inside an
// assistant after Phase 11.2, so we look up agent_id and forward there.
function ChatRedirect({ chatId }: { chatId: string }) {
  const { navigate } = useRouter()
  useEffect(() => {
    let cancelled = false
    api.getChat(chatId).then(c => {
      if (cancelled) return
      if (c) navigate(`/agents/${c.agent_id}/talk/${chatId}`, { replace: true })
      else navigate('/agents', { replace: true })
    })
    return () => { cancelled = true }
  }, [chatId, navigate])
  return (
    <div className="prototype-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100svh' }}>
      <Text size="1" color="gray" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        opening chat …
      </Text>
    </div>
  )
}

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
    { pattern: '/agents/:agentId/talk', render: p => <AgentDetailScreen agentId={p.agentId} tab="talk" /> },
    { pattern: '/agents/:agentId/talk/:chatId', render: p => <AgentDetailScreen agentId={p.agentId} tab="talk" chatId={p.chatId} /> },
    { pattern: '/agents/:agentId/grants', render: p => <AgentDetailScreen agentId={p.agentId} tab="grants" /> },
    { pattern: '/agents/:agentId/activity', render: p => <AgentDetailScreen agentId={p.agentId} tab="activity" /> },
    { pattern: '/agents/:agentId/settings', render: p => <AgentDetailScreen agentId={p.agentId} tab="settings" /> },
    { pattern: '/agents/:agentId/advanced', render: p => <AgentDetailScreen agentId={p.agentId} tab="advanced" /> },
    { pattern: '/tasks', render: () => <TasksScreen /> },
    { pattern: '/tasks/new', render: () => <TaskNewScreen /> },
    { pattern: '/tasks/:taskId', render: p => <TaskDetailScreen taskId={p.taskId} /> },
    { pattern: '/activity', render: () => <RunsScreen /> },
    { pattern: '/activity/:runId', render: p => <RunDetailScreen runId={p.runId} /> },
    { pattern: '/runs', render: () => <Redirect to="/activity" /> },
    { pattern: '/runs/:runId', render: p => <Redirect to={`/activity/${p.runId}`} /> },
    // Top-level Chats was removed: chat now lives inside the agent detail.
    // Direct chat URLs still resolve so bookmarks, training-mode tour links,
    // and internal nav don't 404.
    { pattern: '/chats', render: () => <Redirect to="/agents" /> },
    { pattern: '/chats/new', render: () => <ChatNewScreen /> },
    { pattern: '/chats/:chatId', render: p => <ChatRedirect chatId={p.chatId} /> },
    { pattern: '/approvals', render: () => <ApprovalsScreen /> },
    { pattern: '/approvals/:approvalId', render: p => <ApprovalDetailScreen approvalId={p.approvalId} /> },
    { pattern: '/apps', render: () => <ToolsScreen /> },
    { pattern: '/tools', render: () => <Redirect to="/apps" /> },
    { pattern: '/costs', render: () => <SpendScreen /> },
    { pattern: '/spend', render: () => <Redirect to="/costs" /> },
    { pattern: '/settings', render: () => <SettingsScreen tab="workspace" /> },
    { pattern: '/settings/team', render: () => <SettingsScreen tab="team" /> },
    { pattern: '/settings/history', render: () => <SettingsScreen tab="history" /> },
    { pattern: '/settings/developer', render: () => <SettingsScreen tab="developer" /> },
    { pattern: '/settings/diagnostic', render: () => <SettingsScreen tab="diagnostic" /> },
    // /audit was a top-level page in earlier builds; now lives under Settings.
    { pattern: '/audit', render: () => <Redirect to="/settings/history" /> },
    { pattern: '/profile', render: () => <ProfileScreen /> },
    { pattern: '/learn', render: () => <LearnScreen /> },
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
      scaling="100%"
      hasBackground={false}
    >
      <div className="prototype-root">
        <AuthProvider>
          <RouterProvider>
            <TrainingModeProvider>
              <TrainingBanner />
              <TourProvider>
                <Router />
                <TourOverlay />
                <WelcomeToast />
                <TrainingAutoExit />
              </TourProvider>
            </TrainingModeProvider>
          </RouterProvider>
        </AuthProvider>
        {import.meta.env.DEV && <ThemePanel defaultOpen={false} />}
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
