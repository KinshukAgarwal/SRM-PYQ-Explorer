import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '../lib/utils'

export interface SearchBarProps {
  className?: string
  inputClassName?: string
  placeholder?: string
  showShortcut?: boolean
}

export function SearchBar({ 
  className = '', 
  inputClassName = '', 
  placeholder = 'Search courses or codes...',
  showShortcut = false
}: SearchBarProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const q = searchParams.get('q') || ''
  
  const [inputValue, setInputValue] = useState(q)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedVal = inputValue.trim()
    if (trimmedVal) {
      navigate(`/?q=${encodeURIComponent(trimmedVal)}`)
    } else {
      navigate('/')
    }
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className={cn('flex items-center gap-2.5 px-3 py-2 text-slate-500 bg-slate-100/70 border border-slate-200/60 rounded-lg hover:bg-slate-100 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-200 shadow-sm', className)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input 
        type="text" 
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder} 
        className={cn('w-full bg-transparent outline-none placeholder:text-slate-400 text-sm font-medium text-slate-700', inputClassName)}
      />
      {showShortcut && (
        <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-sans font-bold text-slate-400 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded shadow-sm tracking-wider">CTRL K</kbd>
      )}
    </form>
  )
}
