import React from 'react'

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Authentication flow changed</h1>
        <p className="mt-2 text-muted-foreground">Please return to the app and sign in again.</p>
      </div>
    </div>
  )
}
