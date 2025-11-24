import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const alertVariants = cva(
  'flex items-start gap-3 rounded-md border p-4',
  {
    variants: {
      variant: {
        info: 'border-status-info bg-status-info/10 text-status-info',
        success: 'border-status-success bg-status-success/10 text-status-success',
        warning: 'border-status-warning bg-status-warning/10 text-status-warning',
        error: 'border-status-error bg-status-error/10 text-status-error',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  children: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, children, ...props }, ref) => {
    const Icon = {
      info: Info,
      success: CheckCircle,
      warning: AlertTriangle,
      error: AlertCircle,
    }[variant || 'info'];

    return (
      <div ref={ref} className={alertVariants({ variant, className })} role="alert" {...props}>
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">{children}</div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
