import { inputSyncManager } from '@/lib/input-sync-manager';
import { useAgentDraft } from '@/lib/agent-page-context';
import { useState, useRef, useEffect, useCallback } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useNavigationGuard } from '@/contexts/NavigationGuardContext'

interface UnsavedChangesConfig {
  enabled?: boolean
  getSerializedState: () => string
  isEditing: boolean
  isNewMode: boolean
}

export const useUnsavedChanges = ({ getSerializedState, isEditing, isNewMode, enabled = true }: UnsavedChangesConfig) => {
  useAgentDraft('form', () => enabled && (isEditing || isNewMode) ? JSON.parse(getSerializedState()) : null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [isSaveInFlight, setIsSaveInFlight] = useState(false)
  const pendingNavigationRef = useRef<(() => void) | null>(null)
  const stateReaderRef = useRef(getSerializedState)
  stateReaderRef.current = getSerializedState
  const baselineRef = useRef<string>('')
  const baselineInitializedRef = useRef(false)
  const allowNavigationRef = useRef(false)
  const blockerProceedRef = useRef<(() => void) | null>(null)
  const blockerResetRef = useRef<(() => void) | null>(null)

  const checkDirty = useCallback(() => {
    if (!enabled || !baselineInitializedRef.current) return false
    if (!isEditing && !isNewMode) return false
    return inputSyncManager.hasPendingChanges() || stateReaderRef.current() !== baselineRef.current
  }, [getSerializedState, isEditing, isNewMode, enabled])

  const hasUnsavedChanges = checkDirty()

  const setBaseline = useCallback((overrideState?: any) => {
    const serialized = overrideState
      ? JSON.stringify(overrideState)
      : stateReaderRef.current()
    baselineRef.current = serialized
    baselineInitializedRef.current = true
  }, [getSerializedState])

  const { registerGuard } = useNavigationGuard()

  const blockerState = useBlocker({
    shouldBlockFn: () => checkDirty() && !allowNavigationRef.current,
    withResolver: true,
    disabled: !enabled || (!isEditing && !isNewMode),
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
    if (!enabled) return
    registerGuard(handleNavigationAttempt)
    return () => registerGuard(null)
  }, [handleNavigationAttempt, registerGuard, enabled])

  useEffect(() => {
    if (!enabled || (!isEditing && !isNewMode)) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!checkDirty() || allowNavigationRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enabled, isEditing, isNewMode, checkDirty])

  useEffect(() => {
    if (hasUnsavedChanges) return
    pendingNavigationRef.current = null
    setShowUnsavedDialog(false)
  }, [hasUnsavedChanges])

  return {
    hasUnsavedChanges,
    checkDirty,
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

