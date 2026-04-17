/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Params = Record<string, string>

interface RouterValue {
  path: string
  search: URLSearchParams
  navigate: (to: string, opts?: { replace?: boolean }) => void
}

const RouterCtx = createContext<RouterValue | null>(null)

function parse(hash: string): { path: string; search: URLSearchParams } {
  const stripped = hash.replace(/^#/, '') || '/'
  const [path, q] = stripped.split('?')
  const normalized = path.startsWith('/app') ? path.slice(4) || '/' : '/'
  return { path: normalized, search: new URLSearchParams(q ?? '') }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const value = useMemo<RouterValue>(() => {
    const { path, search } = parse(hash)
    return {
      path,
      search,
      navigate: (to, opts) => {
        const qualified = to.startsWith('/app') ? to : `/app${to === '/' ? '' : to}`
        const next = `#${qualified}`
        if (opts?.replace) {
          window.history.replaceState(null, '', next)
          setHash(window.location.hash)
        } else {
          window.location.hash = qualified
        }
      },
    }
  }, [hash])

  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>
}

export function useRouter(): RouterValue {
  const v = useContext(RouterCtx)
  if (!v) throw new Error('useRouter outside provider')
  return v
}

export function matchRoute(pattern: string, path: string): Params | null {
  const pp = pattern.split('/').filter(Boolean)
  const ap = path.split('/').filter(Boolean)
  if (pp.length !== ap.length) return null
  const params: Params = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i])
    else if (pp[i] !== ap[i]) return null
  }
  return params
}

export function Link({ to, className, children, onClick, style, title }: {
  to: string
  className?: string
  children: ReactNode
  onClick?: () => void
  style?: React.CSSProperties
  title?: string
}) {
  const { navigate } = useRouter()
  return (
    <a
      href={`#${to.startsWith('/app') ? to : `/app${to === '/' ? '' : to}`}`}
      className={className}
      style={style}
      title={title}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        onClick?.()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
