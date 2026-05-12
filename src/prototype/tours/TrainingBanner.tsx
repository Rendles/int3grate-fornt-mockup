import { useEffect } from 'react'
import { Button, Flex, Text } from '@radix-ui/themes'
import { useTrainingMode } from './useTrainingMode'

/**
 * Sticky orange bar pinned to the top of the viewport while training mode
 * is active. Toggles the `with-training-banner` class on `.prototype-root`
 * so the layout reserves space for it (see prototype.css).
 */
export function TrainingBanner() {
  const { active, exit } = useTrainingMode()

  useEffect(() => {
    if (!active) return
    const root = document.querySelector('.prototype-root')
    if (!root) return
    root.classList.add('with-training-banner')
    return () => {
      root.classList.remove('with-training-banner')
    }
  }, [active])

  if (!active) return null

  return (
    <div className="training-banner" role="status" aria-live="polite">
      <span className="training-banner__dot" aria-hidden="true" />
      <Flex align="center" gap="2" flexGrow="1" minWidth="0">
        <Text size="2" weight="medium" style={{ color: 'var(--orange-12)' }}>
          Training mode
        </Text>
        <Text size="2" style={{ color: 'var(--orange-11)' }}>
          — your changes here aren't saved.
        </Text>
      </Flex>
      <Button color="orange" variant="solid" size="1" onClick={exit}>
        Exit training
      </Button>
    </div>
  )
}
