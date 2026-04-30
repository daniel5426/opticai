# Release Checklist

Last Updated: 2026-04-30

## Windows-First Launch Checklist
- Verify backend base URL and required desktop env values
- Verify backend auth config and Heroku `TOKEN_ENCRYPTION_KEY`
- Verify Google OAuth login/connect flow on packaged desktop build
- Verify clinic login, clinic selection, user selection, logout, restart restore
- Verify dashboard, clients, exams, orders, referrals, files, settings
- Verify DOCX export in packaged build
- Verify email test connection and reminder flow
- Decide whether campaigns, AI assistant, and worker stats ship as-is, guarded, or hidden
- Verify Windows packaging artifacts and installer launch
- Verify updater flow assumptions against GitHub release assets

## Evidence To Capture
- Commands run
- Screenshots or notes from packaged app smoke tests
- Blockers found
- Final launch scope reductions
