import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 rounded-xl border border-ink-200 bg-white px-3 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-vivie-300 focus:border-vivie-300',
        'placeholder:text-ink-300 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full min-h-[5rem] rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-vivie-300 focus:border-vivie-300',
      'placeholder:text-ink-300 disabled:opacity-50 resize-y',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'w-full h-9 rounded-xl border border-ink-200 bg-white px-3 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-vivie-300 focus:border-vivie-300',
      'disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, hint, required, children, className }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-xs font-medium text-ink-500 mb-1.5">
        {label}
        {required && <span className="text-vivie-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-ink-300 mt-1">{hint}</span>}
    </label>
  );
}
