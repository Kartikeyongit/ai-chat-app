'use client'

import { motion } from 'framer-motion'

interface AppShellProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function AppShell({ sidebar, children, sidebarOpen, onToggleSidebar }: AppShellProps) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Sidebar — slides over content */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        transition={{ duration: 0.20, ease: 'easeInOut' }}
        className="fixed inset-y-0 left-0 z-40 w-[280px] overflow-hidden bg-bg-secondary border-r border-border-primary shadow-2xl shadow-black/10"
      >
        {/* Click backdrop to close (non-sidebar area) */}
        {sidebarOpen && (
          <div className="fixed inset-0 -z-10 lg:hidden" onClick={onToggleSidebar} />
        )}

        <div className="w-[280px] h-full relative z-10">
          {sidebar}
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="relative flex flex-1 flex-col min-w-0 min-h-0">
        {children}
      </main>
    </div>
  )
}
