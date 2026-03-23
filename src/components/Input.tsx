import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none transition-all duration-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
