import { useState, useRef, useEffect, useCallback } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useNavigationGuard } from '@/contexts/NavigationGuardContext'

interface UnsavedChangesConfig {
  getSerializedState: () => string
  isEditing: boolean
  isNewMode: boolean
}

export const useUnsavedChanges = ({ getSerializedState, isEditing, isNewMode }: UnsavedChangesConfig) => {
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [isSaveInFlight, setIsSaveInFlight] = useState(false)
  const pendingNavigationRef = useRef<(() => void) | null>(null)
  const baselineRef = useRef<string>('')
  const baselineInitializedRef = useRef(false)
  const allowNavigationRef = useRef(false)
  const blockerProceedRef = useRef<(() => void) | null>(null)
  const blockerResetRef = useRef<(() => void) | null>(null)

  const checkDirty = useCallback(() => {
    if (!baselineInitializedRef.current) return false
    if (!isEditing && !isNewMode) return false
    return getSerializedState() !== baselineRef.current
  }, [getSerializedState, isEditing, isNewMode])

  const hasUnsavedChanges = checkDirty()

  const setBaseline = useCallback((overrideState?: any) => {
    const serialized = overrideState
      ? JSON.stringify(overrideState)
      : getSerializedState()
    baselineRef.current = serialized
    baselineInitializedRef.current = true
  }, [getSerializedState])

  const { registerGuard } = useNavigationGuard()

  const blockerState = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges && !allowNavigationRef.current,
    withResolver: true,
    disabled: !hasUnsavedChanges,
    enableBeforeUnload: false
  }, hasUnsavedChanges)

  useEffect(() => {
    if (blockerState.status === 'blocked') {
      blockerProceedRef.current = blockerState.proceed ?? null
      blockerResetRef.current = blockerState.reset ?? null
      pendingNavigationRef.current = null
      setShowUnsavedDialog(true)
    } else if (blockerState.status === 'idle') {
      blockerProceedRef.current = null
      blockerResetRef.current = null
    }
  }, [blockerState.status, blockerState.proceed, blockerState.reset])

  const handleNavigationAttempt = useCallback((action: () => void) => {
    if (checkDirty()) {
      pendingNavigationRef.current = action
      setShowUnsavedDialog(true)
      return
    }
    action()
  }, [checkDirty])

  const handleUnsavedConfirm = useCallback(() => {
    setShowUnsavedDialog(false)
    allowNavigationRef.current = true
    const action = pendingNavigationRef.current
    pendingNavigationRef.current = null
    if (action) {
      action()
    } else {
      blockerProceedRef.current?.()
    }
    setTimeout(() => {
      allowNavigationRef.current = false
    }, 0)
  }, [])

  const handleUnsavedCancel = useCallback(() => {
    setShowUnsavedDialog(false)
    pendingNavigationRef.current = null
    blockerResetRef.current?.()
  }, [])

  useEffect(() => {
    registerGuard(handleNavigationAttempt)
    return () => registerGuard(null)
  }, [handleNavigationAttempt, registerGuard])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (hasUnsavedChanges) return
    pendingNavigationRef.current = null
    setShowUnsavedDialog(false)
  }, [hasUnsavedChanges])

  return {
    hasUnsavedChanges,
    showUnsavedDialog,
    isSaveInFlight,
    setIsSaveInFlight,
    handleNavigationAttempt,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    setBaseline,
    baselineInitializedRef,
    allowNavigationRef
  }
}

