// src/utils/driveClient.js
const { google } = require('googleapis');

async function getDriveFileStream(fileId) {
  // credentials.json must be present in backend/ and be a service account key
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return res.data; // readable stream
}

module.exports = { getDriveFileStream };
