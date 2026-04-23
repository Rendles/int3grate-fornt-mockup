import { Button, Flex, Select, Text } from '@radix-ui/themes'

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
    <Flex
      align="center"
      justify="between"
      gap="4"
      wrap="wrap"
      px="4"
      py="2"
      style={{
        borderTop: '1px solid var(--gray-6)',
        background: 'var(--gray-3)',
      }}
    >
      <Text size="1" color="gray" style={{ whiteSpace: 'nowrap' }}>
        {start}–{end} of {total} {label}
      </Text>
      <Flex align="center" gap="2">
        {onPageSizeChange && (
          <Flex align="center" gap="2">
            <Text size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              rows/page
            </Text>
            <Select.Root
              value={String(pageSize)}
              onValueChange={v => onPageSizeChange(Number(v))}
              size="1"
            >
              <Select.Trigger variant="soft" />
              <Select.Content>
                {pageSizes.map(n => (
                  <Select.Item key={n} value={String(n)}>{n}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        )}
        <Button
          variant="soft"
          size="1"
          color="gray"
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          disabled={safePage <= 0}
          aria-label="Previous page"
        >
          ← prev
        </Button>
        <Text size="1" style={{ minWidth: 48, textAlign: 'center' }}>
          {safePage + 1} / {totalPages}
        </Text>
        <Button
          variant="soft"
          size="1"
          color="gray"
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          disabled={safePage >= totalPages - 1}
          aria-label="Next page"
        >
          next →
        </Button>
      </Flex>
    </Flex>
  )
}
