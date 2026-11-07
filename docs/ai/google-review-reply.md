# Google verification reply

Working text prepared for the August 10, 2026 email. The owner confirmed sending the
reply on November 7. This is the draft source, not a copy of the sent message.
The updated privacy policy was published on November 7, 2026.

Thread: `19b4e014a6c8d460`

To: `api-oauth-dev-verification-reply+1cqmpeejxqqyp1d@google.com`

Subject: Re: [Action Needed] OAuth Verification Request Acknowledgement

---

Hello Third-Party Data Safety Team,

Thank you for your August 10 email regarding project opticai-465420 (507617691117).

Prysm has AI features, but they are separate from our Google integrations. We do not send data obtained through our Google sign-in or Calendar integrations to OpenRouter or any AI model provider. This includes Google account/profile information, profile photos, OAuth credentials, Calendar API data, and derived Google integration data.

Google data is used only for authentication, account linking and authorized Calendar functionality. Our AI agents have no Google API connections and do not access Google Photos, Gmail or Drive. AI processes independently entered clinic records and content submitted by clinic staff. When a Prysm appointment is also exported to Google Calendar, AI uses the original clinic record, not data retrieved from Google.

AI providers and models:

- Our internal Agents24 backend uses OpenRouter API access as an external model gateway. Agents24 is our own application backend.
- Configured models include OpenAI GPT-6 Luna for clinic assistance, Mistral PDF Parser for OCR (the gateway integration has also used OpenAI gpt-5.4-mini as its transport model), OpenAI text-embedding-3-large for document search, and ElevenLabs Scribe v2 for speech recognition.
- Separate direct OpenAI API features use gpt-6-luna for campaigns and WhatsApp replies. The retained direct assistant and insights use gpt-6.1-sol when Agents24 is disabled.
- Service plans/tiers: [insert the OpenRouter plan/tier and any separately used OpenAI/ElevenLabs API plans].

Google integration data stays outside AI requests and tool results. We do not use, transfer or sell raw, aggregated, anonymized or derived Google user data to create, train or improve foundational or generalized AI/ML models. Direct OpenAI Responses requests additionally use store=false and background=false; we do not claim Zero Data Retention.

Our privacy policy at https://prysm.co.il/privacy includes our affirmative commitment to the Google API Services User Data Policy and Google Workspace API User Data and Developer Policy, including the Limited Use requirements.

Please let us know if any further clarification is needed.

Kind regards,
Daniel Benassaya
Prysm
