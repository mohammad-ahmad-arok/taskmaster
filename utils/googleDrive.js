const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

// Uses OAuth2 credentials for a REAL Google account (not a service
// account — personal service accounts have zero Drive storage quota of
// their own, so uploads through one fail even into a shared folder).
// The refresh token is generated once via scripts/getGoogleRefreshToken.js
// and never expires unless the user revokes access.
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob' // desktop/CLI-style redirect, no web server needed
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

const isConfigured = () =>
  !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );

/**
 * Uploads a file already sitting on local disk (from multer) to the
 * configured Google Drive folder, makes it viewable by anyone with the
 * link, and returns a shareable URL. Does NOT delete the local temp file
 * — the caller is responsible for cleanup so this function stays a pure
 * "upload" step.
 */
async function uploadFileToDrive(localFilePath, originalName, mimeType) {
  if (!isConfigured()) {
    throw new Error(
      'Google Drive is not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN / GOOGLE_DRIVE_FOLDER_ID env vars).'
    );
  }

  const fileMetadata = {
    name: originalName,
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
  };

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: fs.createReadStream(localFilePath),
  };

  const uploaded = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = uploaded.data.id;

  // Make it viewable by anyone with the link (no Google sign-in required
  // to open it) — matches "click the note attachment to view/download".
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  const file = await drive.files.get({
    fileId,
    fields: 'id, name, webViewLink, webContentLink',
  });

  return {
    id: file.data.id,
    name: file.data.name,
    viewUrl: file.data.webViewLink, // opens in Drive's viewer — what we store/link to
  };
}

module.exports = { uploadFileToDrive, isConfigured };
