# Google Calendar Integration Setup

This document explains how to set up Google Calendar integration for your optical clinic management system.

## Prerequisites

1. Google Cloud Console account
2. Google Calendar API enabled
3. OAuth 2.0 credentials configured

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Desktop application" as application type
4. Add authorized redirect URIs:
   - `http://localhost:3000/oauth/callback`
5. Download the credentials JSON file

## Step 3: Configure Environment Variables

Create a `.env` file in your project root with the following content:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Replace `your-client-id` and `your-client-secret` with the values from your Google Cloud Console credentials.

## Step 4: OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Configure your application:
   - Application name: "Optical Clinic Management"
   - User support email: Your email
   - Scopes: Add the following scopes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/userinfo.email`
3. Add test users if your app is in testing mode

## Step 5: Testing the Integration

1. Start your application
2. Go to Settings > Personal Profile
3. Click "Connect Google Account"
4. A Google OAuth window will open
5. Grant the necessary permissions
6. Your Google account will be connected
7. Use "Sync Now" to sync your appointments

## Troubleshooting

### Common Issues

1. **"Invalid client" error**: Check your client ID and secret
2. **"Redirect URI mismatch"**: Ensure the redirect URI is exactly `http://localhost:3000/oauth/callback`
3. **"Access denied" error**: Make sure you've granted all necessary permissions
4. **"API not enabled" error**: Enable the Google Calendar API in your Google Cloud Console

### Scopes Required

The application requires the following OAuth scopes:
- `https://www.googleapis.com/auth/calendar` - Full calendar access
- `https://www.googleapis.com/auth/calendar.events` - Calendar events access
- `https://www.googleapis.com/auth/userinfo.email` - User email access

### Rate Limits

Google Calendar API has rate limits:
- 1,000,000 requests per day
- 100 requests per 100 seconds per user

## Security Considerations

1. Never commit your `.env` file to version control
2. Use environment variables for sensitive data
3. Regularly rotate your OAuth credentials
4. Monitor API usage in Google Cloud Console

## Features Supported

- ✅ Connect Google account via OAuth
- ✅ Sync appointments to Google Calendar
- ✅ Create calendar events with client details
- ✅ Update and delete calendar events
- ✅ Token refresh for long-term access
- ✅ Disconnect Google account 