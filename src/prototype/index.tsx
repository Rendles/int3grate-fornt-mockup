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
// Registration is hidden until POST /auth/register lands on the backend.
// See docs/handoff-prep.md § 1.1. Restore this import when re-enabling the route below.
// import RegisterScreen from './screens/RegisterScreen'
import HomeScreen from './screens/HomeScreen'
import AgentsScreen from './screens/AgentsScreen'
import AgentDetailScreen from './screens/AgentDetailScreen'
import AgentNewScreen from './screens/AgentNewScreen'
import RunDetailScreen from './screens/RunDetailScreen'
import RunsScreen from './screens/RunsScreen'
// AuditScreen folded back into Activity (RunsScreen is the single grouped view).
// File preserved for restoration if a dedicated compliance surface is needed.
// import AuditScreen from './screens/AuditScreen'
// Settings is hidden in MVP — Audit log was extracted into its own screen.
// See docs/handoff-prep.md (Settings hide entry). Restore this import together
// with the /settings/* routes below and the sidebar item in shell.tsx when
// re-enabling.
// import SettingsScreen from './screens/SettingsScreen'
import ChatNewScreen from './screens/ChatNewScreen'
import ApprovalsScreen from './screens/ApprovalsScreen'
import ApprovalDetailScreen from './screens/ApprovalDetailScreen'
// Apps page is hidden in MVP — connections are managed per-agent on the
// agent's permissions tab. See docs/handoff-prep.md (Apps hide entry).
// Restore this import together with the /apps route below and the sidebar
// item in shell.tsx when re-enabling.
// import ToolsScreen from './screens/ToolsScreen'
import SpendScreen from './screens/SpendScreen'
import ProfileScreen from './screens/ProfileScreen'
import LearnScreen from './screens/LearnScreen'
import NotFoundScreen from './screens/NotFoundScreen'
import WorkspacesScreen from './screens/WorkspacesScreen'
// Sandbox: design exploration only. Reachable via direct URL + a sidebar
// entry with a muted "preview" badge. See docs/agent-plans/.
import TeamBridgeScreen from './screens/sandbox/TeamBridgeScreen'
// WelcomeChatScreen removed — standalone preview no longer needed
import { DevModeProvider, DevModeRemount } from './dev/dev-mode-provider'
import { WorkspaceRemount } from './components/workspace-remount'

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

  // Registration route hidden until POST /auth/register exists on the backend.
  // See docs/handoff-prep.md § 1.1. Restore together with the import above and
  // the "Create account" button in LoginScreen.tsx when re-enabling.
  // if (path === '/register') {
  //   return <RegisterScreen />
  // }

  if (!user || path === '/login') {
    return <LoginScreen />
  }

  const routes: { pattern: string; render: (p: Record<string, string>) => React.ReactNode }[] = [
    { pattern: '/', render: () => <HomeScreen /> },
    { pattern: '/agents', render: () => <AgentsScreen /> },
    { pattern: '/agents/new', render: () => <AgentNewScreen /> },
    { pattern: '/agents/:agentId', render: p => <AgentDetailScreen agentId={p.agentId} tab="overview" /> },
    { pattern: '/agents/:agentId/talk', render: p => <AgentDetailScreen agentId={p.agentId} tab="talk" /> },
    { pattern: '/agents/:agentId/talk/:chatId', render: p => <AgentDetailScreen agentId={p.agentId} tab="talk" chatId={p.chatId} /> },
    { pattern: '/agents/:agentId/grants', render: p => <AgentDetailScreen agentId={p.agentId} tab="grants" /> },
    { pattern: '/agents/:agentId/activity', render: p => <AgentDetailScreen agentId={p.agentId} tab="activity" /> },
    { pattern: '/agents/:agentId/settings', render: p => <AgentDetailScreen agentId={p.agentId} tab="settings" /> },
    { pattern: '/agents/:agentId/advanced', render: p => <AgentDetailScreen agentId={p.agentId} tab="advanced" /> },
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
    // Apps route hidden in MVP. Per-agent permissions are the canonical place
    // to manage which apps an agent can use. See docs/handoff-prep.md.
    // { pattern: '/apps', render: () => <ToolsScreen /> },
    // { pattern: '/tools', render: () => <Redirect to="/apps" /> },
    { pattern: '/costs', render: () => <SpendScreen /> },
    { pattern: '/spend', render: () => <Redirect to="/costs" /> },
    // Settings routes are hidden in MVP. Audit log lives at /audit (below);
    // workspace edit / team / developer / diagnostic surfaces are not
    // shipping yet. See docs/handoff-prep.md (Settings hide entry).
    // { pattern: '/settings', render: () => <SettingsScreen tab="workspace" /> },
    // { pattern: '/settings/team', render: () => <SettingsScreen tab="team" /> },
    // { pattern: '/settings/history', render: () => <SettingsScreen tab="history" /> },
    // { pattern: '/settings/developer', render: () => <SettingsScreen tab="developer" /> },
    // { pattern: '/settings/diagnostic', render: () => <SettingsScreen tab="diagnostic" /> },
    // /audit folded back into /activity (no toggle). Restore here +
    // shell.tsx Audit nav item + AuditScreen import above when re-enabling.
    // { pattern: '/audit', render: () => <AuditScreen /> },
    { pattern: '/profile', render: () => <ProfileScreen /> },
    { pattern: '/learn', render: () => <LearnScreen /> },
    { pattern: '/workspaces', render: () => <WorkspacesScreen /> },
    // Sandbox routes — design previews, surfaced in the sidebar with a
    // muted "preview" badge. See docs/agent-plans/.
    { pattern: '/sandbox/team-bridge', render: () => <TeamBridgeScreen /> },
    // /sandbox/welcome-chat removed — standalone preview no longer needed
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
            <DevModeProvider>
              <TrainingModeProvider>
                <TrainingBanner />
                <TourProvider>
                  <DevModeRemount>
                    <WorkspaceRemount>
                      <Router />
                    </WorkspaceRemount>
                  </DevModeRemount>
                  <TourOverlay />
                  <WelcomeToast />
                  <TrainingAutoExit />
                </TourProvider>
              </TrainingModeProvider>
            </DevModeProvider>
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

