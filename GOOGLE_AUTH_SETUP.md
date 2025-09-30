# Google OAuth Setup for OpticAI

This guide explains how to set up Google OAuth authentication for your OpticAI application using Supabase.

## Prerequisites

1. Supabase project set up and running
2. Google Cloud Console account
3. OpticAI application running

## Step 1: Configure Google Cloud Console

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (required for OAuth):
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

### 1.2 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure OAuth consent screen if not done already:
   - Choose "External" for user type
   - Fill in application name: "OpticAI"
   - Add your email as support email
   - Add authorized domains (your Supabase project domain)
4. Choose "Web application" as application type
5. Set authorized redirect URIs:
   - `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
   - Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference
6. Leave "Authorized JavaScript origins" empty or set to your Supabase URL if required
7. Note down your Client ID and Client Secret

## Step 2: Configure Supabase

### 2.1 Enable Google Provider
1. Go to your Supabase Dashboard
2. Navigate to Authentication > Providers
3. Find Google and click to configure
4. Enable the Google provider
5. Enter your Google OAuth credentials:
   - Client ID: From Google Cloud Console
   - Client Secret: From Google Cloud Console

### 2.2 Configure Redirect URLs
1. In Supabase Dashboard, go to Authentication > URL Configuration
2. Add your site URL: `http://localhost:5173` (for development)
3. Add redirect URLs:
   - `http://localhost:5173/control-center`
   - Add production URLs when deploying

## Step 3: Update Environment Variables

Add the following environment variables to your `.env` file:

```env
# Supabase Configuration (should already exist)
VITE_SUPABASE_URL=https://YOUR_SUPABASE_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend Supabase Configuration
SUPABASE_URL=https://YOUR_SUPABASE_PROJECT_REF.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
```

## Step 4: Test the Integration

### 4.1 Development Testing
1. Start your backend server: `cd backend && python main.py`
2. Start your frontend: `npm run dev`
3. Navigate to `http://localhost:5173/control-center`
4. Click "התחבר עם Google" (Login with Google)
5. Complete the Google OAuth flow
6. Verify you're redirected back to the control center

### 4.2 First-Time Google User Flow
When a user signs in with Google for the first time:
1. They'll be authenticated with Supabase
2. A new user record will be created in your database
3. They'll be assigned the `company_ceo` role automatically
4. If no company exists, they'll be redirected to the setup wizard
5. If a company exists, they'll be taken to the control center dashboard

## Step 5: Production Deployment

### 5.1 Update Google OAuth Settings
1. In Google Cloud Console, add production redirect URI:
   - `https://YOUR_DOMAIN.com/control-center`
2. Add production domain to authorized domains

### 5.2 Update Supabase Settings
1. In Supabase Dashboard, update site URL to your production domain
2. Add production redirect URLs

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**
   - Ensure the redirect URI in Google Cloud Console matches exactly
   - Check for trailing slashes and HTTP vs HTTPS

2. **"Invalid client" error**
   - Verify your Google Client ID and Secret in Supabase
   - Ensure the Google+ API is enabled

3. **User creation fails**
   - Check your backend logs for database errors
   - Verify the user creation API endpoint is working

4. **Infinite redirect loop**
   - Clear browser cookies and localStorage
   - Check the OAuth callback handling in the frontend

### Debug Steps

1. Check browser network tab for failed requests
2. Verify Supabase authentication logs
3. Check backend logs for user creation errors
4. Ensure all environment variables are set correctly

## Security Considerations

1. Never commit OAuth credentials to version control
2. Use environment variables for all sensitive data
3. Regularly rotate OAuth credentials
4. Monitor authentication logs for suspicious activity
5. Implement proper error handling for failed authentications

## Features Supported

- ✅ Google OAuth login for Control Center
- ✅ Automatic user creation for first-time Google users
- ✅ Integration with existing company/clinic structure
- ✅ Seamless redirect to setup wizard for new companies
- ✅ Session management through Supabase
- ✅ Role-based access control (CEO role assignment)

## Next Steps

After completing this setup:
1. Test the complete authentication flow
2. Verify user creation and company association
3. Test the setup wizard flow for new Google users
4. Configure additional OAuth providers if needed (GitHub, etc.)
