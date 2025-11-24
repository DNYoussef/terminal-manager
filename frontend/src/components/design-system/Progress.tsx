import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const progressVariants = cva(
  'relative w-full overflow-hidden rounded-full bg-surface-hover',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const progressBarVariants = cva(
  'h-full transition-all duration-300 ease-in-out rounded-full',
  {
    variants: {
      variant: {
        primary: 'bg-accent-primary',
        success: 'bg-status-success',
        warning: 'bg-status-warning',
        error: 'bg-status-error',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

export interface ProgressProps extends VariantProps<typeof progressVariants> {
  value: number; // 0-100
  variant?: 'primary' | 'success' | 'warning' | 'error';
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  size,
  variant = 'primary',
  className,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={progressVariants({ size, className })} role="progressbar" aria-valuenow={clampedValue} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={progressBarVariants({ variant })}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
};
