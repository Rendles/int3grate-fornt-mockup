import { AppShell } from '../components/shell'
import { EmptyState } from '../components/states'
import { useRouter } from '../router'

export default function NotFoundScreen() {
  const { path } = useRouter()
  return (
    <AppShell crumbs={[{ label: 'app', to: '/' }, { label: '404' }]}>
      <div className="page">
        <EmptyState
          title="Route not found"
          body={`No screen matched "${path}". Pick a destination from the sidebar.`}
          action={{ label: 'Back to home', href: '/' }}
        />
      </div>
    </AppShell>
  )
}
