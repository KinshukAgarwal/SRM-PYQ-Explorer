import { forwardRef, ReactNode } from 'react'
import { Link, LinkProps } from 'react-router-dom'
import { cn } from '../lib/utils'

export interface LinkButtonProps extends LinkProps {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ variant = 'primary', className = '', children, ...props }, ref) => {
    const baseClass = variant === 'primary' 
      ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600/20' 
      : 'bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-200/50'
    
    return (
      <Link
        ref={ref}
        className={cn('inline-flex items-center justify-center text-center', baseClass, className)}
        {...props}
      >
        {children}
      </Link>
    )
  }
)

LinkButton.displayName = 'LinkButton'
