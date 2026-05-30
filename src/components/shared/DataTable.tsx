import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnFiltersState,
  ExpandedState,
  getExpandedRowModel,
  VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  error?: string | null
  emptyMessage?: string
  onRowClick?: (row: TData) => void
  virtualized?: boolean
  maxHeight?: string | number
  className?: string
  renderSubComponent?: (props: { row: any }) => React.ReactNode
  getRowCanExpand?: (row: any) => boolean
  enableRowSelection?: boolean
  rowSelection?: Record<string, boolean>
  onRowSelectionChange?: (updater: any) => void
  getRowId?: (originalRow: TData, index: number, parent?: any) => string
  renderFooter?: () => React.ReactNode
  isCustomRow?: (row: TData) => boolean
  renderCustomRow?: (row: TData) => React.ReactNode
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (updater: any) => void
  rowClassName?: (row: TData) => string
}

/**
 * Performance-optimized memoized row component for high-density virtualized grids.
 * Prevents heavy cell re-rendering during rapid scroll events.
 */
const MemoizedVirtualRow = React.memo(({ 
  row, 
  virtualRow, 
  onRowClick, 
  rowClassName, 
  isCustomRow, 
  renderCustomRow 
}: { 
  row: any, 
  virtualRow: any, 
  onRowClick?: any, 
  rowClassName?: any, 
  isCustomRow?: any, 
  renderCustomRow?: any 
}) => {
  return (
    <TableRow
      data-index={virtualRow.index}
      className={cn(
        "group transition-colors hover:bg-muted/40 dark:hover:bg-muted/20 border-b",
        onRowClick && "cursor-pointer",
        rowClassName?.(row.original)
      )}
      onClick={() => onRowClick?.(row.original)}
    >
      {isCustomRow?.(row.original) && renderCustomRow 
        ? renderCustomRow(row.original)
        : row.getVisibleCells().map((cell: any) => (
        <TableCell key={cell.id} className="px-4 py-2 text-xs overflow-hidden break-words whitespace-normal">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
})
MemoizedVirtualRow.displayName = 'MemoizedVirtualRow'

/**
 * DataTable
 * 
 * Enterprise-grade table primitive with virtualization support.
 * Designed for high-density engineering data (RAB/WBS).
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  error,
  emptyMessage = "No results found.",
  onRowClick,
  virtualized = false,
  maxHeight = "600px",
  className,
  rowClassName,
  renderSubComponent,
  getRowCanExpand,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  renderFooter,
  isCustomRow,
  renderCustomRow,
  columnVisibility,
  onColumnVisibilityChange
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand,
    enableRowSelection,
    onRowSelectionChange,
    getRowId,
    onColumnVisibilityChange,
    state: {
      sorting,
      columnFilters,
      expanded,
      ...(rowSelection !== undefined && { rowSelection }),
      ...(columnVisibility !== undefined && { columnVisibility }),
    },
  })


  // Virtualization Setup
  const isVirtualized = data.length > 100 || virtualized
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40, // Estimated height of a row
    overscan: 10,
  })

  if (error) {
    return (
      <div className="flex h-32 w-full flex-col items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-4 text-center">
        <p className="text-sm font-medium text-rose-800">Error loading data</p>
        <p className="text-xs text-rose-600">{error}</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <div
        ref={tableContainerRef}
        className="relative overflow-auto custom-scrollbar"
        style={{ height: isVirtualized ? maxHeight : 'auto' }}
      >
        <Table className="relative w-full border-separate border-spacing-0 table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-muted/60 dark:bg-background/80 backdrop-blur-sm shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        header.column.getCanSort() ? (
                          <button
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors select-none w-full"
                            onClick={header.column.getToggleSortingHandler()}
                            title={`Sort by ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : ''}`}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp size={10} className="shrink-0 text-primary" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown size={10} className="shrink-0 text-primary" />
                            ) : (
                              <ArrowUpDown size={10} className="shrink-0 opacity-30" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j} className="h-10 px-4">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length > 0 ? (
              isVirtualized ? (
                <>
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}>
                      <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                    </tr>
                  )}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    return (
                      <MemoizedVirtualRow
                        key={row.id}
                        row={row}
                        virtualRow={virtualRow}
                        onRowClick={onRowClick}
                        rowClassName={rowClassName}
                        isCustomRow={isCustomRow}
                        renderCustomRow={renderCustomRow}
                      />
                    )
                  })}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }}>
                      <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                    </tr>
                  )}
                </>
              ) : (
                rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={cn(
                          "group transition-colors hover:bg-muted/40 dark:hover:bg-muted/20 border-b",
                          onRowClick && "cursor-pointer",
                          rowClassName?.(row.original)
                      )}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {isCustomRow?.(row.original) && renderCustomRow 
                        ? renderCustomRow(row.original)
                        : row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 py-2 text-xs overflow-hidden break-words whitespace-normal">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && renderSubComponent && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                          {renderSubComponent({ row })}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {renderFooter && renderFooter()}
        </Table>
      </div>
    </div>
  )
}
