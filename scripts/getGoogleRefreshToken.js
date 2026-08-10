/**
 * Run this ONCE, locally, on your own machine (not on Render) to link a
 * real Google account to the app for file storage.
 *
 * Usage:
 *   1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET below (or export them
 *      as environment variables before running).
 *   2. node scripts/getGoogleRefreshToken.js
 *   3. Open the printed URL in your browser, sign in with the Google
 *      account you want to store files in (e.g. a company Gmail),
 *      approve access, then copy the code Google shows you.
 *   4. Paste that code back into the terminal when prompted.
 *   5. The script prints a refresh_token — copy it into Render's
 *      environment variables as GOOGLE_REFRESH_TOKEN.
 *
 * The refresh token does not expire unless the account owner revokes
 * access from https://myaccount.google.com/permissions — you only need
 * to run this script once.
 */
require('dotenv').config();
const readline = require('readline');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '❌ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (in server/.env or as env vars) before running this script.'
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // required to get a refresh_token
  prompt: 'consent', // forces Google to always return a refresh_token
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\n1) Open this URL in your browser and sign in with the Google account\n   you want files stored in:\n');
console.log(authUrl);
console.log('\n2) After approving access, Google will show you a code.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste that code here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Success! Add this to Render\'s environment variables:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n(Keep GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set there too — same values you used above.)\n');
  } catch (err) {
    console.error('❌ Failed to exchange code for tokens:', err.message);
    process.exit(1);
  }
});
