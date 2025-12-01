'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatCredits } from '@/lib/credits-client'

interface CreditsDisplayProps {
  isAdmin?: boolean
  initialBalance?: number
}

export function CreditsDisplay({ isAdmin = false, initialBalance = 0 }: CreditsDisplayProps) {
  const [balance, setBalance] = useState(initialBalance)
  const [isLoading, setIsLoading] = useState(false)

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/credits')
      if (response.ok) {
        const data = await response.json()
        setBalance(data.balance)
      }
    } catch (err) {
      console.error('Error fetching credits:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    if (!isAdmin) {
      fetchCredits()
    }
  }, [isAdmin, fetchCredits])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (isAdmin) return
    
    const interval = setInterval(fetchCredits, 10000)
    return () => clearInterval(interval)
  }, [isAdmin, fetchCredits])

  // Refresh on window focus (when user comes back to tab)
  useEffect(() => {
    if (isAdmin) return

    const handleFocus = () => {
      fetchCredits()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isAdmin, fetchCredits])

  // Listen for custom event to trigger refresh (can be called from anywhere)
  useEffect(() => {
    if (isAdmin) return

    const handleCreditsUpdate = () => {
      fetchCredits()
    }

    window.addEventListener('credits-updated', handleCreditsUpdate)
    return () => window.removeEventListener('credits-updated', handleCreditsUpdate)
  }, [isAdmin, fetchCredits])

  return (
    <Link 
      href="/dashboard/billing"
      className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
        isAdmin 
          ? 'bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20' 
          : 'bg-muted/50 hover:bg-muted'
      }`}
    >
      <svg className={`w-4 h-4 ${isAdmin ? 'text-violet-500' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={`text-sm font-medium ${isAdmin ? 'text-violet-500' : ''} ${isLoading ? 'opacity-50' : ''}`}>
        {isAdmin ? '∞' : formatCredits(balance)}
      </span>
    </Link>
  )
}

// Helper function to trigger credits refresh from anywhere
export function triggerCreditsRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('credits-updated'))
  }
}

