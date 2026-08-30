import type { ReactNode } from 'react';
import { Text } from './Text';

export type TableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
};

export function Table<T>({ columns, rows, rowKey }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-paper-raised">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3">
                <Text variant="caption" as="span">
                  {column.header}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-4 align-middle">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
