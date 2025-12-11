'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { formatAsCredits } from '@/lib/credits-client'

interface CreditsDisplayProps {
  isAdmin?: boolean
  initialBalance?: number
}

export function CreditsDisplay({ isAdmin = false, initialBalance = 0 }: CreditsDisplayProps) {
  const [balance, setBalance] = useState(initialBalance)
  const [isLoading, setIsLoading] = useState(false)
  const locale = useLocale()
  const t = useTranslations('common')

  const isNegative = balance < 0

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

  // Determine styles based on state
  const getContainerStyles = () => {
    if (isAdmin) {
      return 'bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20'
    }
    if (isNegative) {
      return 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 animate-pulse'
    }
    return 'bg-muted/50 hover:bg-muted'
  }

  const getIconColor = () => {
    if (isAdmin) return 'text-violet-500'
    if (isNegative) return 'text-red-500'
    return 'text-emerald-500'
  }

  const getTextColor = () => {
    if (isAdmin) return 'text-violet-500'
    if (isNegative) return 'text-red-500 font-semibold'
    return ''
  }

  return (
    <Link 
      href={`/${locale}/dashboard/billing`}
      className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${getContainerStyles()}`}
      title={isNegative ? t('negativeBalanceHint') : undefined}
    >
      {isNegative ? (
        // Warning icon for negative balance
        <svg className={`w-4 h-4 ${getIconColor()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ) : (
        // Normal coin icon
        <svg className={`w-4 h-4 ${getIconColor()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <span className={`text-sm font-medium ${getTextColor()} ${isLoading ? 'opacity-50' : ''}`}>
        {isAdmin ? '∞' : formatAsCredits(balance)}
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

