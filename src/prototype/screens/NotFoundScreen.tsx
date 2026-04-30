import { AppShell } from '../components/shell'
import { EmptyState } from '../components/states'
import { useRouter } from '../router'

export default function NotFoundScreen() {
  const { path } = useRouter()
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: '404' }]}>
      <div className="page">
        <EmptyState
          title="Page not found"
          body={`We couldn't find anything at "${path}". Try the sidebar or jump back home.`}
          action={{ label: 'Back to Home', href: '/' }}
        />
      </div>
    </AppShell>
  )
}
