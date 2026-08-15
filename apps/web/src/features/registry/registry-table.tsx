import { Table } from '@mantine/core'
import { flexRender, type useReactTable } from '@tanstack/react-table'

export function RegistryTable<T>({ table }: { table: ReturnType<typeof useReactTable<T>> }) {
  return (
    <section className="rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.Th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {table.getRowModel().rows.map((row) => (
            <Table.Tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </section>
  )
}
