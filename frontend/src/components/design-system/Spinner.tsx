import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const spinnerVariants = cva(
  'inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
      variant: {
        primary: 'text-accent-primary',
        secondary: 'text-text-secondary',
        success: 'text-status-success',
        error: 'text-status-error',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'primary',
    },
  }
);

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size, variant, className }) => {
  return (
    <div
      className={spinnerVariants({ size, variant, className })}
      role="status"
      aria-label="Loading"
    />
  );
};
