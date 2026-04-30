import { useEffect } from 'react'
import { Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { IconX } from '../components/icons'
import { useTour } from './useTour'

const AUTO_DISMISS_MS = 10_000

/**
 * Bottom-right pinned, non-blocking welcome toast for first-time visitors.
 * Surfaces the Learning Center once after the very first authenticated
 * mount and never again on this browser (flag persisted in
 * localStorage["proto.tours.v1"].welcomePromptShown).
 */
export function WelcomeToast() {
  const { user } = useAuth()
  const { path, navigate } = useRouter()
  const { welcomePromptShown, markWelcomePromptShown } = useTour()

  // Show only once authenticated and on a real route. /learn itself is
  // excluded — if the user is already there, the toast is redundant.
  const visible =
    !welcomePromptShown
    && user !== null
    && path !== '/login'
    && path !== '/register'
    && path !== '/learn'

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => markWelcomePromptShown(), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [visible, markWelcomePromptShown])

  if (!visible) return null

  const open = () => {
    markWelcomePromptShown()
    navigate('/learn')
  }

  return (
    <div className="welcome-toast" role="status" aria-live="polite">
      <Flex direction="column" gap="2">
        <Flex align="start" justify="between" gap="2">
          <Text as="div" size="2" weight="medium">New here?</Text>
          <IconButton
            variant="ghost"
            color="gray"
            size="1"
            onClick={() => markWelcomePromptShown()}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <IconX className="ic ic--sm" />
          </IconButton>
        </Flex>
        <Text as="div" size="2" color="gray">
          The Learning Center has short tours that walk you through agents,
          approvals, and activity.
        </Text>
        <Flex justify="end">
          <Button size="1" onClick={open}>
            Open Learning Center
          </Button>
        </Flex>
      </Flex>
    </div>
  )
}
