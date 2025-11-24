import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const tableVariants = cva(
  'w-full border-collapse',
  {
    variants: {
      variant: {
        default: 'bg-surface-primary',
        bordered: 'border border-border-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const theadVariants = cva(
  'border-b border-border-primary bg-surface-secondary'
);

const thVariants = cva(
  'px-4 py-3 text-left text-sm font-semibold text-text-primary'
);

const tbodyVariants = cva('');

const trVariants = cva(
  'border-b border-border-secondary hover:bg-surface-hover transition-colors'
);

const tdVariants = cva(
  'px-4 py-3 text-sm text-text-secondary'
);

export interface TableProps extends React.HTMLAttributes<HTMLTableElement>, VariantProps<typeof tableVariants> {}
export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
export interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, variant, ...props }, ref) => (
    <table ref={ref} className={tableVariants({ variant, className })} {...props} />
  )
);
Table.displayName = 'Table';

export const TableHead = React.forwardRef<HTMLTableSectionElement, TableHeadProps>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={theadVariants({ className })} {...props} />
  )
);
TableHead.displayName = 'TableHead';

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={tbodyVariants({ className })} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={trVariants({ className })} {...props} />
  )
);
TableRow.displayName = 'TableRow';

export const TableHeaderCell = React.forwardRef<HTMLTableCellElement, TableHeaderCellProps>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={thVariants({ className })} {...props} />
  )
);
TableHeaderCell.displayName = 'TableHeaderCell';

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={tdVariants({ className })} {...props} />
  )
);
TableCell.displayName = 'TableCell';
