import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent-primary text-text-inverse',
        secondary: 'border-transparent bg-surface text-text-secondary',
        outline: 'border-border text-text-primary',
        success: 'border-transparent bg-status-success text-text-inverse',
        warning: 'border-transparent bg-status-warning text-text-inverse',
        error: 'border-transparent bg-status-error text-text-inverse',
        info: 'border-transparent bg-status-info text-text-inverse',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div className={badgeVariants({ variant, className })} ref={ref} {...props} />
    );
  }
);

Badge.displayName = 'Badge';
