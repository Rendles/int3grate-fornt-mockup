import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { useTour } from './useTour'
import { useRouter } from '../router'
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

  // Hotkeys live on the parent so they attach/detach with the whole tour
  // lifecycle, independent of which step is currently mounted.
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

  // navigateTo inheritance: if the current step doesn't declare a route,
  // fall back to the most recent prior step that did. This makes
  // Back / prev navigation restore the right page automatically — every
  // step ends up with an effective `navigateTo`, so the engine's mount
  // effect always brings the user back to where the step expects to live,
  // both forward and backward.
  const effectiveStep: TourStep = step.navigateTo
    ? step
    : { ...step, navigateTo: inheritedNavigateTo(activeTour.steps, stepIndex) }

  // No `key={step.id}` — the same TourStepView (and the same spotlight /
  // tooltip DOM nodes) persists across step changes, so the CSS transitions
  // on `.tour__spot` / `.tour__tooltip` (top / left / width / height) animate
  // smoothly from the previous step's rect to the next one. State that
  // shouldn't leak between steps (specifically the "target missing" flag) is
  // derived inside TourStepView via a step-id-keyed sentinel rather than via
  // a remount.
  return (
    <TourStepView
      step={effectiveStep}
      stepIndex={stepIndex}
      total={activeTour.steps.length}
      onNext={next}
      onPrev={prev}
      onSkipTour={() => endTour(false)}
    />
  )
}

function inheritedNavigateTo(steps: TourStep[], fromIdx: number): string | undefined {
  for (let i = fromIdx - 1; i >= 0; i--) {
    if (steps[i].navigateTo) return steps[i].navigateTo
  }
  return undefined
}

interface TourStepViewProps {
  step: TourStep
  stepIndex: number
  total: number
  onNext: () => void
  onPrev: () => void
  onSkipTour: () => void
}

function TourStepView({ step, stepIndex, total, onNext, onPrev, onSkipTour }: TourStepViewProps) {
  // rect / tooltipHeight intentionally persist across step changes — the
  // overlay is no longer keyed, so the same DOM nodes for spotlight and
  // tooltip stay in the tree and CSS transitions interpolate top/left/
  // width/height from the previous step's rect to the new one.
  const [rect, setRect] = useState<Rect | null>(null)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  // "Missing" is derived: which step.id (if any) exhausted its retry
  // budget without finding a target. Storing the id rather than a boolean
  // means the flag auto-resets when step.id changes — no synchronous
  // setMissing(false) at the top of the resolution effect (which would
  // trip react-hooks/set-state-in-effect).
  const [exhaustedStepId, setExhaustedStepId] = useState<string | null>(null)
  const missing = exhaustedStepId === step.id
  const tooltipRef = useRef<HTMLDivElement>(null)
  const targetElRef = useRef<Element | null>(null)
  const { navigate } = useRouter()

  // Resolve target on step change. If `navigateTo` is set, route there
  // first — the destination screen has to render before its target is
  // queryable, so we widen the retry budget to ~1.5s. The cleanup cancels
  // both the in-flight pending timeout and any state update from a
  // late-resolving query.
  //
  // We deliberately do NOT setRect(null) at the top of this effect: keeping
  // the previous step's rect in state is what makes the spotlight slide
  // smoothly from old position to new (CSS transition on the persistent
  // `.tour__spot` element). Once the new target resolves, setRect overwrites
  // and the transition fires.
  //
  // `navigate` is intentionally excluded from deps. RouterProvider rebuilds
  // its memoised value on every hash change, so including it would re-fire
  // the effect after our own navigate() resolved — leading to a redundant
  // navigate() and tryFind() restart.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    const maxAttempts = step.navigateTo ? 50 : 20
    const retryDelay = step.navigateTo ? 30 : 25

    if (step.navigateTo) {
      navigate(step.navigateTo)
    }

    const tryFind = () => {
      if (cancelled) return
      const el = document.querySelector(step.target)
      if (el) {
        targetElRef.current = el
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
        setRect(readRect(el))
        return
      }
      if (attempts++ < maxAttempts) {
        timer = setTimeout(tryFind, retryDelay)
      } else {
        setExhaustedStepId(step.id)
      }
    }
    tryFind()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, step.target, step.navigateTo])

  // Re-measure on resize / scroll while the target is locked.
  useEffect(() => {
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
  }, [])

  // Track tooltip height via ResizeObserver. useLayoutEffect ensures the
  // first measurement lands before paint, avoiding a flicker from the
  // viewport-centred fallback to the anchored position. Functional
  // setTooltipHeight skips the need for tooltipHeight in deps, so the empty
  // deps array satisfies react-hooks/exhaustive-deps.
  useLayoutEffect(() => {
    const el = tooltipRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      if (!h) return
      setTooltipHeight(prev => (Math.abs(h - prev) > 1 ? h : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
            onClick={onSkipTour}
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
              onClick={onPrev}
              disabled={isFirst}
              style={{ margin: 0 }}
            >
              Back
            </Button>
            <Button
              variant="ghost"
              color="gray"
              size="1"
              onClick={onSkipTour}
              style={{ margin: 0 }}
            >
              Skip tour
            </Button>
          </Flex>
          <Flex gap="2" align="center">
            {!isLast && (
              <Button variant="soft" color="gray" size="1" onClick={onNext}>
                Skip step
              </Button>
            )}
            <Button size="1" onClick={onNext}>
              {isLast ? 'Done' : 'Next →'}
            </Button>
          </Flex>
        </Flex>
      </div>
    </div>
  )
}
