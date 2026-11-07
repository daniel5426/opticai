# Google verification: AI and Google data

Updated: November 7, 2026. This note addresses the August 10 email for project
`opticai-465420` / `507617691117`.

## Our answer

Prysm has AI features, but Google sign-in and Calendar do not supply data to those
features. Google account/profile information, OAuth credentials, Calendar API data and
derived integration metadata are excluded from AI inputs and tool results. AI uses
independently entered clinic records and content supplied by clinic staff. Exporting
a clinic-entered appointment to Calendar does not turn the original record into data
retrieved from Google. No Google Photos, Gmail or Drive connector is declared in the
clinic agent package. This describes our integration flows; it is not a claim that
arbitrary content manually pasted or uploaded by users can be classified by origin.

Agents24 is the owner's internal AI backend. It is not a separate third-party subscription
for this disclosure. OpenRouter is the external model gateway, as confirmed by the owner.
The configured model list includes OpenAI GPT-6 Luna, Mistral PDF Parser, OpenAI
text-embedding-3-large and ElevenLabs Scribe v2. The OCR gateway integration has also used
OpenAI gpt-5.4-mini as a transport model. Retained direct OpenAI features use gpt-6-luna
for campaigns/WhatsApp and gpt-6.1-sol for the assistant/insights when Agents24 is disabled.
Do not describe all of these as a single direct OpenRouter route: separate direct OpenAI
calls remain in the source. No model itself is self-hosted or offline.

## What the latest email actually asks for

- List external AI providers, plans/tiers, gateways and downstream models.
- Explain the controls preventing Google data from being used for generalized model
  training. Our relevant control is separation of Google integrations from AI inputs.
  Direct OpenAI calls also set `store=false` and `background=false`; these are not a
  claim of provider-wide Zero Data Retention.
- Host an affirmative Limited Use statement. The live policy already contains one;
  the local website update explains the internal Agents24 backend and Google-data
  separation in Hebrew, English and French.
- Reply directly to the email with the requested details and confirmation.

The email does not explicitly request screenshots, contract copies or account-level
proof. Its new-demo request is conditional on retaining integrations that would train
on Workspace/Photos user data and re-architecting for isolation. Do not turn that into
an unconditional new-demo requirement. No such training use was identified in this review.
This note does not determine the status of earlier, separate verification requests.

## Current delivery status

The simplified policy was published on November 7, 2026 from `prysm-web` commit
`bc522c06c0ccc8afad12a2c8f5985a008e2579b4`, Vercel deployment
`dpl_3uW2GPzAyWFe4enNEHDZ6ESxhA3Y` (production READY). `/privacy`, `/he/privacy`,
`/en/privacy` and `/fr/privacy` returned HTTP 200 and the updated Agents24/OpenRouter
and Limited Use text. Both GitHub CI jobs passed for that exact revision. The owner
confirmed sending the Google reply before requesting publication; the saved source
text is not a verified copy of the sent email.

Disclosure tests, scoped lint, TypeScript and six locale/viewport browser checks passed
before publication. Vercel completed the release build/type check and deployment in
73.5 seconds. CI now pins the matching Biome version, lints changed files and avoids
a duplicate type check; no unrelated backend/model/provider settings were deployed.

Migration note: Not needed; this update changes policy text, tests and the unsent reply,
with no persisted data, schema or API contract changes.
