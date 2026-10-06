# Google verification reply — hold for production verification

Status: prepared, not sent. Do not use completed-action wording until rollout.md gates are complete and https://prysm.co.il/privacy is published. Confirm actual API retention settings before sending. No new demo is claimed.

Existing Gmail thread: 19b4e014a6c8d460
Subject: Re: [Action Needed] OAuth Verification Request Acknowledgement
To: api-oauth-dev-verification-reply+1cqmpeejxqqyp1d@google.com
Project: opticai-465420 / 507617691117

---

Hello Third-Party Data Safety Team,

Thank you for your August 10 request regarding project opticai-465420 (507617691117). Please find our responses below.

**AI provider and service tier:** Prysm uses OpenAI’s paid API service across its existing application plans. Optional sharing of API data for model training is disabled. We use `gpt-6.1-sol` for the clinic assistant and client insights, and `gpt-6-luna` for campaign generation and WhatsApp replies.

**Gateways and other models:** Requests go directly from our backend to OpenAI. We do not use OpenRouter, other model aggregators, or self-hosted/offline AI models.

**Google data isolation:** Our automatic AI inputs exclude Google OAuth credentials, Google account/profile data, Calendar API responses, event identifiers, and derived integration metadata. Google data is used for account authentication and authorized Calendar functionality. Clinic-entered records processed by AI are collected independently of Google APIs, including appointment details independently exported to Calendar. Arbitrary text users type or paste cannot be reliably classified by origin; our isolation claim applies to automatic integration inputs.

**Training and storage controls:** API training data sharing is disabled, and our Responses requests set `store=false`. We do not use Google Workspace API data to create, train, or improve generalized AI/ML models. We do not represent `store=false` as Zero Data Retention.

**Public disclosure:** Our updated policy at https://prysm.co.il/privacy describes collection, use, storage, retention, deletion, infrastructure processors and separate AI processing, and includes our affirmative commitment to Google’s Limited Use requirements. The policy is available in Hebrew, English and French.

Please continue the verification review and let us know if any specific requirement remains outstanding.

Kind regards,
Daniel Benassaya
Prysm
