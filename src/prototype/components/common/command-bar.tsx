export function CommandBar({
  parts,
}: {
  parts: { label: string; value: string; tone?: 'accent' | 'warn' | 'muted' }[]
}) {
  return (
    <div className="command-bar">
      {parts.map((p, i) => (
        <div key={i}>
          <span>{p.label}</span>{' '}
          <span
            className={`command-bar__val${p.tone === 'accent' ? ' command-bar__val--accent' : ''}`}
            style={p.tone === 'warn' ? { color: 'var(--amber-11)' } : undefined}
          >
            {p.value}
          </span>
        </div>
      ))}
    </div>
  )
}
