import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  'flex w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-border hover:border-border-light',
        error: 'border-status-error focus-visible:ring-status-error',
        success: 'border-status-success focus-visible:ring-status-success',
      },
      size: {
        sm: 'h-8 text-xs',
        md: 'h-10 text-sm',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={inputVariants({ variant: error ? 'error' : variant, size, className })}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-status-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
