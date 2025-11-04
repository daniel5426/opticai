"use client"

import React, { useCallback } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useNavigationGuard } from "@/contexts/NavigationGuardContext"

type GuardedRouterLinkProps = React.ComponentProps<typeof Link>

type LinkOptions = {
  to?: unknown
  params?: unknown
  search?: unknown
  hash?: string
  state?: unknown
  replace?: boolean
  target?: string
  reloadDocument?: boolean
}

export function GuardedRouterLink(props: GuardedRouterLinkProps) {
  const { onClick, target, reloadDocument, ...linkProps } = props as GuardedRouterLinkProps & LinkOptions
  const { to, params, search, hash, state, replace } = props as GuardedRouterLinkProps & LinkOptions
  const navigate = useNavigate()
  const { runGuard, hasGuard } = useNavigationGuard()

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return
      if (reloadDocument) return
      if (target && target !== "_self") return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!hasGuard()) return
      event.preventDefault()
      runGuard(() => {
        navigate({
          to: to as any,
          params: params as any,
          search: search as any,
          hash: hash as any,
          state,
          replace,
        })
      })
    },
    [onClick, reloadDocument, target, hasGuard, runGuard, navigate, to, params, search, hash, state, replace],
  )

  return (
    <Link
      {...(linkProps as GuardedRouterLinkProps)}
      onClick={handleClick}
      target={target}
      reloadDocument={reloadDocument}
    />
  )
}


