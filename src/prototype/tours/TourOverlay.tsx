import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { useTour } from './TourProvider'
import { IconX } from '../components/icons'
import type { TourPlacement, TourStep } from './types'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const TOOLTIP_WIDTH = 320
const TOOLTIP_GAP = 14
const VIEWPORT_MARGIN = 12

function computeTooltipPosition(
  rect: Rect,
  tooltipHeight: number,
  placement: TourPlacement,
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let top = 0
  let left = 0

  switch (placement) {
    case 'right':
      left = rect.left + rect.width + TOOLTIP_GAP
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      break
    case 'left':
      left = rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      break
    case 'bottom':
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      top = rect.top + rect.height + TOOLTIP_GAP
      break
    case 'top':
    default:
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      top = rect.top - TOOLTIP_GAP - tooltipHeight
      break
  }

  // Clamp into viewport.
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - tooltipHeight - VIEWPORT_MARGIN))

  return { top, left }
}

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function TourOverlay() {
  const { activeTour, stepIndex, next, prev, endTour } = useTour()
  const step: TourStep | undefined = activeTour?.steps[stepIndex]

  const [rect, setRect] = useState<Rect | null>(null)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const [missing, setMissing] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const targetElRef = useRef<Element | null>(null)

  // Resolve target on step change. Retry briefly to handle async-mounted DOM.
  useEffect(() => {
    if (!step) {
      targetElRef.current = null
      setRect(null)
      setMissing(false)
      return
    }
    let cancelled = false
    let attempts = 0
    const tryFind = () => {
      if (cancelled) return
      const el = document.querySelector(step.target)
      if (el) {
        targetElRef.current = el
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
        setRect(readRect(el))
        setMissing(false)
        return
      }
      if (attempts++ < 20) {
        setTimeout(tryFind, 25)
      } else {
        targetElRef.current = null
        setMissing(true)
      }
    }
    tryFind()
    return () => {
      cancelled = true
    }
  }, [step])

  // Re-measure on resize / scroll while a target is locked.
  useEffect(() => {
    if (!step || !targetElRef.current) return
    let raf = 0
    const update = () => {
      raf = 0
      if (targetElRef.current) setRect(readRect(targetElRef.current))
    }
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(update)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [step])

  // Measure tooltip height after render so we can vertically center against target.
  useLayoutEffect(() => {
    if (!tooltipRef.current) return
    const h = tooltipRef.current.getBoundingClientRect().height
    if (h && Math.abs(h - tooltipHeight) > 1) setTooltipHeight(h)
  })

  // Hotkeys.
  useEffect(() => {
    if (!activeTour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        endTour(false)
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTour, next, prev, endTour])

  if (!activeTour || !step) return null

  const total = activeTour.steps.length
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1
  const padding = step.spotlightPadding ?? 6
  const placement = step.placement ?? 'right'

  const tooltipPos =
    rect && tooltipHeight > 0
      ? computeTooltipPosition(rect, tooltipHeight, placement)
      : null

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="tour__spot"
          style={{
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          }}
        />
      ) : (
        <div className="tour__backdrop" />
      )}

      <div
        ref={tooltipRef}
        className="tour__tooltip"
        style={{
          width: TOOLTIP_WIDTH,
          ...(tooltipPos
            ? { top: tooltipPos.top, left: tooltipPos.left }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
        }}
      >
        <Flex align="center" justify="between" gap="2" mb="2">
          <Text size="1" color="gray" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {stepIndex + 1} / {total}
          </Text>
          <IconButton
            variant="ghost"
            color="gray"
            size="1"
            onClick={() => endTour(false)}
            aria-label="Close tour"
            title="Skip tour (Esc)"
          >
            <IconX className="ic ic--sm" />
          </IconButton>
        </Flex>

        <Text as="div" size="3" weight="medium" mb="1">{step.title}</Text>
        <Text as="div" size="2" color="gray">
          {missing ? 'This element is not on the current screen — skip ahead or end the tour.' : step.body}
        </Text>

        <Flex align="center" justify="between" gap="2" mt="4">
          <Flex gap="3" align="center">
            <Button
              variant="ghost"
              color="gray"
              size="1"
              onClick={prev}
              disabled={isFirst}
              style={{ margin: 0 }}
            >
              Back
            </Button>
            <Button
              variant="ghost"
              color="gray"
              size="1"
              onClick={() => endTour(false)}
              style={{ margin: 0 }}
            >
              Skip tour
            </Button>
          </Flex>
          <Flex gap="2" align="center">
            {!isLast && (
              <Button variant="soft" color="gray" size="1" onClick={next}>
                Skip step
              </Button>
            )}
            <Button size="1" onClick={next}>
              {isLast ? 'Done' : 'Next →'}
            </Button>
          </Flex>
        </Flex>
      </div>
    </div>
  )
}
