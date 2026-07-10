'use client'

import { Plus, Trash2, Edit3, Check, X, PanelRightClose, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signOut } from 'next-auth/react'

interface Conversation {
  id: string
  title: string
  updatedAt: string
}

interface SidebarProps {
  conversations: Conversation[]
  activeId?: string
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onClose?: () => void
  user?: { name?: string | null; email?: string | null; image?: string | null }
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onRename, onDelete, onClose, user }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id)
    setEditValue(conv.title)
  }

  const confirmRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pt-1 px-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-md font-semibold text-text-primary tracking-tight">AI Chat</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            aria-label="Close sidebar"
          >
            <PanelRightClose size={19} />
          </button>
        )}
      </div>

      <div className="px-3 pb-3">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors border border-border-primary border-dashed"
        >
          <Plus size={16} />
          New conversation
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        <AnimatePresence mode="popLayout">
          {conversations.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-8 text-center text-xs text-text-tertiary"
            >
              No conversations yet
            </motion.p>
          ) : (
            conversations.map((conv) => (
              <motion.div
                key={conv.id}
                layout
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 2 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className={cn(
                  'group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors overflow-hidden',
                  activeId === conv.id
                    ? 'bg-accent-subtle text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                )}
                onClick={() => onSelect(conv.id)}
              >

                {editingId === conv.id ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-1 items-center gap-1"
                  >
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 bg-bg-elevated text-sm text-text-primary rounded px-1.5 py-0.5 border border-accent outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button onClick={(e) => { e.stopPropagation(); confirmRename() }} className="text-text-tertiary hover:text-text-primary">
                      <Check size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(null) }} className="text-text-tertiary hover:text-text-primary">
                      <X size={14} />
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <span className="flex-1 truncate">{conv.title}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); startRename(conv) }}
                        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
                        className="p-1 rounded text-text-tertiary hover:text-destructive hover:bg-bg-elevated transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {user && (
        <div className="border-t border-border-primary px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
              {user.image ? (
                <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <User size={16} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {user.name || 'User'}
              </p>
              <p className="truncate text-xs text-text-tertiary">
                {user.email || ''}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
