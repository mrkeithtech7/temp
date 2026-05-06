// ─────────────────────────────────────────────────
//  lib/catbox.js
//  Catbox.moe upload helper for MOON-X V2
//  Keith Tech © 2026
//
//  Catbox API: https://catbox.moe/tools.php
//  Endpoint  : POST https://catbox.moe/user/api.php
//  Response  : plain text URL e.g. https://files.catbox.moe/abc123.jpg
// ─────────────────────────────────────────────────

'use strict';

const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');

const CATBOX_API = 'https://catbox.moe/user/api.php';
const TIMEOUT    = 120_000; // 2 minutes — large files can be slow

/**
 * Upload a Buffer to Catbox.
 *
 * @param {Buffer}  buffer    - The file data
 * @param {string}  filename  - e.g. 'image.jpg'
 * @param {string}  mimetype  - e.g. 'image/jpeg'
 * @returns {Promise<string>} Catbox URL
 */
async function uploadBuffer(buffer, filename, mimetype) {
  if (!buffer || buffer.length === 0) throw new Error('Empty buffer provided');

  // Write to a temp file so we can stream it
  const tmpPath = path.join(os.tmpdir(), `catbox_${Date.now()}_${filename}`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    return await _uploadFile(tmpPath, filename, mimetype);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

/**
 * Upload a local file path to Catbox.
 *
 * @param {string}  filePath  - Absolute path to the file
 * @param {string}  [filename]  - Override filename (defaults to basename)
 * @param {string}  [mimetype]  - Override mime (defaults to octet-stream)
 * @returns {Promise<string>} Catbox URL
 */
async function uploadFile(filePath, filename, mimetype) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const name = filename || path.basename(filePath);
  const mime = mimetype || 'application/octet-stream';
  return await _uploadFile(filePath, name, mime);
}

// ── Internal: does the actual multipart POST ──────
async function _uploadFile(filePath, filename, mimetype) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  // Anonymous upload — no userhash needed
  form.append('fileToUpload', fs.createReadStream(filePath), {
    filename,
    contentType: mimetype,
  });

  let response;
  try {
    response = await axios.post(CATBOX_API, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: TIMEOUT,
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });
  } catch (err) {
    throw new Error(`Catbox request failed: ${err.message}`);
  }

  const result = typeof response.data === 'string' ? response.data.trim() : '';

  // Catbox returns the plain URL on success, or an error message
  if (result.startsWith('https://files.catbox.moe/')) {
    return result;
  }

  // Any other text is an error from Catbox
  throw new Error(`Catbox error: ${result || 'Unknown response'}`);
}

module.exports = { uploadBuffer, uploadFile };
