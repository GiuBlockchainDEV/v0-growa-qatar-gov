'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

// Types for different drawer content
export type DrawerObjectType = 'farm' | 'zone' | 'sensor' | 'alert' | 'inspection' | 'program' | 'crop'

export interface DrawerObject {
  id: string
  type: DrawerObjectType
  name: string
  data?: Record<string, unknown>
}

interface DrawerContextType {
  isOpen: boolean
  object: DrawerObject | null
  openDrawer: (object: DrawerObject) => void
  closeDrawer: () => void
  setObject: (object: DrawerObject | null) => void
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined)

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [object, setObjectState] = useState<DrawerObject | null>(null)

  const openDrawer = useCallback((obj: DrawerObject) => {
    setObjectState(obj)
    setIsOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setIsOpen(false)
    // Delay clearing object to allow animation
    setTimeout(() => setObjectState(null), 300)
  }, [])

  const setObject = useCallback((obj: DrawerObject | null) => {
    setObjectState(obj)
  }, [])

  return (
    <DrawerContext.Provider value={{ isOpen, object, openDrawer, closeDrawer, setObject }}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer() {
  const context = useContext(DrawerContext)
  if (!context) {
    throw new Error('useDrawer must be used within a DrawerProvider')
  }
  return context
}
