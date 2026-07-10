'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number
  maxRows?: number
}

const Input = forwardRef<HTMLTextAreaElement, InputProps>(
  ({ className, minRows = 1, maxRows = 8, onChange, ...props }, ref) => {
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target
      textarea.style.height = 'auto'
      const lineHeight = 24
      const maxHeight = maxRows * lineHeight
      const newHeight = Math.min(textarea.scrollHeight, maxHeight)
      textarea.style.height = `${newHeight}px`
      onChange?.(e)
    }

    return (
      <textarea
        ref={ref}
        rows={minRows}
        onChange={handleInput}
        className={cn(
          'w-full resize-none rounded-2xl bg-bg-tertiary px-5 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary',
          'border border-border-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
          'transition-all duration-150',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
