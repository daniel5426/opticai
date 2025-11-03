// Global router type registration for TanStack Router
// Ensures route paths infer params/search types across the app
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof import('./routes/router').router
  }
}


