import type { ComponentType } from 'react'

type AnyFn = (...args: any[]) => any
type AnyRecord = Record<string, any>
type AnyRouter = any
type AnyRoute = any

declare module '@tanstack/react-router' {
  export type Router = AnyRouter
  export type Route = AnyRoute
  export const RouterProvider: ComponentType<any>
  export const Link: ComponentType<any>
  export const Outlet: ComponentType<any>
  export function createRouter(...args: any[]): AnyRouter
  export function createRoute(...args: any[]): AnyRoute
  export function createRootRoute(...args: any[]): AnyRoute
  export function createMemoryHistory(...args: any[]): any
  export function useNavigate(): AnyFn
  export function useLocation(): any
  export function useSearch<TSearch extends AnyRecord = AnyRecord>(options?: any): TSearch
  export function useParams<TParams extends AnyRecord = AnyRecord>(options?: any): TParams
  export function useRouter(): AnyRouter
  export function useRouterState(options?: any): any
  export function useMatch(...args: any[]): any
  export function useBlocker(...args: any[]): any
}

