# Clean Authentication System - OpticAI

## Overview

The authentication system has been completely redesigned with a clean, single-responsibility architecture that eliminates the infinite loops, 401 errors, and navigation issues that were present in the previous implementation.

## Core Architecture

### 1. AuthService (`src/lib/auth/AuthService.ts`)

**Single source of truth for all authentication logic:**

- **State Management**: Centralized `AuthState` enum with clear states:
  - `LOADING`: Initial authentication check in progress
  - `UNAUTHENTICATED`: No valid session
  - `AUTHENTICATED`: Valid user session with complete setup
  - `SETUP_REQUIRED`: Valid Supabase session but user needs company/clinic setup

- **Session Handling**: Unified Supabase session management
- **Navigation Logic**: Smart routing based on authentication state
- **Setup Flow**: Streamlined new user onboarding

### 2. Simplified UserContext (`src/contexts/UserContext.tsx`)

**Clean context that subscribes to AuthService:**

- Removed complex `useEffect` chains and race conditions
- Single subscription to AuthService state changes
- Maintains theme application and localStorage management
- Preserves clinic-specific functionality for non-Control Center flows

### 3. Clean Page Components

All authentication-related pages now have single responsibilities:

#### ControlCenterPage
- Simple login/register forms
- Direct AuthService integration
- Automatic navigation on auth state changes

#### SetupWizardPage  
- Only handles setup flow for `SETUP_REQUIRED` state
- Clean step-by-step wizard
- Direct integration with AuthService.completeSetup()

#### WelcomeScreen
- Simple entry point with two options
- Auth state-aware redirects
- No complex bootstrap logic

#### UserSelectionPage
- Maintains existing clinic user selection flow
- Supports all login types: password, passwordless, Google OAuth
- Clean separation from Control Center flow

## Authentication Flows

### 1. Control Center Flow (Google OAuth + Manual)

```
User → WelcomeScreen → ControlCenterPage
                    ↓
            [Google OAuth / Manual Login]
                    ↓
              AuthService validates
                    ↓
        ┌─────── Existing User ────────┐
        ↓                             ↓
  Control Center Dashboard    Clinic Dashboard
        ↓                             ↓
    (CEO Role)              (Other Roles)
                    
                    OR
                    ↓
             New User (Setup Required)
                    ↓
              SetupWizardPage
                    ↓
            AuthService.completeSetup()
                    ↓
          Control Center Dashboard
```

### 2. Clinic Flow (Password + Passwordless + Google)

```
User → WelcomeScreen → ControlCenterPage (with embedded clinic entrance) → UserSelectionPage
                                                ↓
                            [Password / Passwordless / Google Login]
                                                ↓
                                        Clinic Dashboard
```

## Key Features

### ✅ **Eliminated Issues**
- **No more infinite loops**: Single state machine prevents race conditions
- **No more 401 errors**: Proper token management and session validation
- **No more navigation chaos**: Centralized routing logic
- **No more localStorage conflicts**: Clean key management

### ✅ **Authentication Methods**
- **Google OAuth**: Full integration with calendar scopes
- **Manual Login**: Email/password authentication
- **Passwordless Login**: For clinic users without passwords
- **Session Persistence**: Automatic session restoration

### ✅ **Multi-Clinic Support**
- **Control Center**: Company-wide management (CEO only)
- **Clinic-Specific**: Individual clinic access
- **Role-Based Access**: Proper permission enforcement
- **Data Isolation**: Clinic-scoped data filtering

## State Management

### AuthState Flow

```
LOADING → UNAUTHENTICATED → [Login] → AUTHENTICATED
    ↓                                      ↑
    └── SETUP_REQUIRED → [Setup] ──────────┘
```

### Navigation Logic

```typescript
switch (authState) {
  case AUTHENTICATED:
    if (user.role === 'company_ceo') {
      → /control-center/dashboard
    } else if (hasClinic) {
      → /dashboard  
    } else {
      → /control-center (clinic entrance now embedded)
    }
    break
    
  case SETUP_REQUIRED:
    → /setup-wizard
    break
    
  case UNAUTHENTICATED:
    → /
    break
}
```

## Usage Examples

### Authentication Check
```typescript
const { authState, currentUser } = useUser()

if (authState === AuthState.LOADING) {
  return <Loader />
}

if (authState === AuthState.UNAUTHENTICATED) {
  return <LoginPrompt />
}

// User is authenticated
```

### Login Actions
```typescript
// Manual login
await authService.signInWithPassword(email, password)

// Google OAuth
await authService.signInWithGoogle()

// Sign up
await authService.signUp(email, password, fullName)

// Logout
await authService.signOut()
```

### Setup Completion
```typescript
await authService.completeSetup(companyData, clinicData)
```

## File Structure

```
src/
├── lib/auth/
│   └── AuthService.ts          # Core authentication service
├── contexts/
│   └── UserContext.tsx         # Simplified context
├── pages/
│   ├── ControlCenterPage.tsx   # Clean login/register
│   ├── SetupWizardPage.tsx     # Streamlined setup
│   ├── WelcomeScreen.tsx       # Simple entry point
│   └── UserSelectionPage.tsx   # Clinic user selection
```

## Migration Benefits

1. **Reliability**: No more infinite loops or 401 errors
2. **Maintainability**: Single responsibility components
3. **Debuggability**: Clear state machine and logging
4. **Extensibility**: Easy to add new authentication methods
5. **Performance**: Eliminated unnecessary re-renders and API calls

## Environment Variables

Required environment variables remain the same:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (backend)
- `SUPABASE_JWT_SECRET` (backend)

## Testing

The new system should be tested with:
1. Fresh Google OAuth signup → Setup wizard → Control Center
2. Existing Google user login → Direct to dashboard
3. Manual signup → Setup wizard → Control Center  
4. Existing manual user login → Direct to dashboard
5. Clinic entrance → User selection → Various login types
6. Session persistence across app restarts
7. Logout and re-login flows

This clean architecture eliminates the authentication chaos and provides a solid foundation for future development.
