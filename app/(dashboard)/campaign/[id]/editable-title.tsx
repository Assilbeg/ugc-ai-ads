'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil } from 'lucide-react'

interface EditableTitleProps {
  campaignId: string
  initialTitle: string
  brief: Record<string, any>
  className?: string
}

export function EditableTitle({ campaignId, initialTitle, brief, className = '' }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [editedTitle, setEditedTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    const trimmed = editedTitle.trim()
    if (!trimmed || trimmed === title) {
      setIsEditing(false)
      setEditedTitle(title)
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const newBrief = { ...brief, what_selling: trimmed }
      await (supabase.from('campaigns') as any)
        .update({ brief: newBrief })
        .eq('id', campaignId)
      
      setTitle(trimmed)
      setIsEditing(false)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
      setEditedTitle(title)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditedTitle(title)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={`flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
          disabled={saving}
          placeholder="Titre de la campagne..."
        />
      </div>
    )
  }

  return (
    <div className="group/title flex items-start gap-2">
      <h1 className={className}>
        {title}
      </h1>
      <button
        onClick={() => {
          setEditedTitle(title)
          setIsEditing(true)
        }}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/title:opacity-100 transition-all mt-1"
        title="Modifier le titre"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  )
}





