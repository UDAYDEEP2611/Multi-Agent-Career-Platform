const { OAuth2Client } = require("google-auth-library");

// Sign in with Google: the browser gets a signed ID token from Google, and
// this checks its signature, expiry, issuer and that it was issued for this app.

const googleClientId = () => String(process.env.GOOGLE_CLIENT_ID || "").trim();

const client = new OAuth2Client();

// { googleId, email, emailVerified, issuedAt } or null if the token isn't valid
async function verifyGoogleCredential(credential) {
  if (typeof credential !== "string" || !credential || credential.length > 8192 || !googleClientId()) return null;

  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: googleClientId() });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    return {
      googleId: payload.sub,
      email: String(payload.email || "").trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      issuedAt: payload.iat
    };
  } catch (error) {
    // Google's keys couldn't be fetched: not the same as a bad token
    if (!/token|signature|audience|issuer|envelope|payload|segments/i.test(error.message)) throw error;
    return null;
  }
}

module.exports = { googleClientId, verifyGoogleCredential };
