export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizes = [10, 25, 50],
  onPageSizeChange,
  label = 'rows',
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  pageSizes?: number[]
  onPageSizeChange?: (n: number) => void
  label?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const start = total === 0 ? 0 : safePage * pageSize + 1
  const end = Math.min((safePage + 1) * pageSize, total)

  return (
    <div className="pagination">
      <span className="pagination__info">
        {start}–{end} of {total} {label}
      </span>
      <div className="pagination__controls">
        {onPageSizeChange && (
          <label className="pagination__size">
            <span>rows/page</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizes.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <button
          className="pagination__nav"
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          disabled={safePage <= 0}
          aria-label="Previous page"
        >
          ← prev
        </button>
        <span className="pagination__page">
          {safePage + 1} / {totalPages}
        </span>
        <button
          className="pagination__nav"
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          disabled={safePage >= totalPages - 1}
          aria-label="Next page"
        >
          next →
        </button>
      </div>
    </div>
  )
}
