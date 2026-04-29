import { Badge, Box, Button, Flex, Grid, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader } from '../components/common'
import { IconCheck } from '../components/icons'
import { useAuth } from '../auth'
import { useTour } from '../tours/useTour'
import { useTrainingMode } from '../tours/useTrainingMode'
import { TOURS } from '../tours/registry'
import type { TourAudience, TourEntry, TourGroup } from '../tours/registry'
import type { Role } from '../lib/types'

const GROUPS: { id: TourGroup; label: string }[] = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'core-workflows', label: 'Core workflows' },
  { id: 'admin-setup', label: 'Admin setup' },
]

function audienceLabel(a: TourAudience): string {
  if (a === 'admin') return 'Admin'
  if (a === 'domain_admin') return 'Team admin'
  return 'All'
}

// Permissive hierarchy: admin can run admin and domain_admin tours; domain_admin
// can run domain_admin tours; member can only run "all" tours.
function canRun(audience: TourAudience, role: Role | undefined): boolean {
  if (audience === 'all') return true
  if (audience === 'admin') return role === 'admin'
  if (audience === 'domain_admin') return role === 'admin' || role === 'domain_admin'
  return false
}

export default function LearnScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'Learning Center' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="LEARN"
          title={<>Learning <em>Center.</em></>}
          subtitle="Short interactive tours of the platform. Each tour walks you through a real flow with example data — your changes during the tour aren't saved to your workspace."
        />

        {GROUPS.map(group => {
          const tours = TOURS.filter(t => t.group === group.id)
          if (tours.length === 0) return null
          return (
            <Box key={group.id} mb="6">
              <Caption mb="3">{group.label}</Caption>
              <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="4">
                {tours.map(entry => (
                  <TourCard key={entry.tour.id} entry={entry} />
                ))}
              </Grid>
            </Box>
          )
        })}
      </div>
    </AppShell>
  )
}

function TourCard({ entry }: { entry: TourEntry }) {
  const { user } = useAuth()
  const { startTour, isCompleted } = useTour()
  const { enter: enterTraining } = useTrainingMode()

  const completed = isCompleted(entry.tour.id)
  const allowed = canRun(entry.audience, user?.role)

  const start = () => {
    if (!allowed) return
    if (entry.scenarioId) enterTraining(entry.scenarioId)
    startTour(entry.tour)
  }

  return (
    <div className="card">
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Flex align="center" gap="2" wrap="wrap">
          <Badge color="gray" variant="soft" radius="full" size="1">
            {audienceLabel(entry.audience)}
          </Badge>
          <Text size="1" color="gray">{entry.durationLabel}</Text>
          {completed && (
            <Badge color="green" variant="soft" radius="full" size="1">
              <IconCheck className="ic ic--sm" /> Completed
            </Badge>
          )}
        </Flex>
        <Box>
          <Text as="div" size="3" weight="medium" mb="1">{entry.tour.name}</Text>
          <Text as="div" size="2" color="gray">{entry.description}</Text>
        </Box>
        <Box mt="auto">
          <Button
            size="2"
            disabled={!allowed}
            title={!allowed ? `${audienceLabel(entry.audience)} only` : undefined}
            onClick={start}
          >
            {completed ? 'Restart tour' : 'Start tour'}
          </Button>
        </Box>
      </div>
    </div>
  )
}
