import { authenticateGoogleWeb, refreshGoogleWebToken } from './google-web-oauth';

// Calendar writes are API-owned. Keep OAuth bridge names for web/desktop parity.
export const googleWebAPI = {
  googleOAuthAuthenticate: authenticateGoogleWeb,
  googleOAuthRefreshToken: refreshGoogleWebToken,
};
