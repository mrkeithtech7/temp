// lib/cdn.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Upload buffer to tmpfiles.org and get a public URL
async function uploadToTmpFiles(buffer, fileName) {
    const tmpDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tempFile = path.join(tmpDir, `cdn_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`);
    fs.writeFileSync(tempFile, buffer);

    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(tempFile), fileName);
        const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: form.getHeaders(),
            timeout: 60000
        });
        if (response.data?.data?.url) {
            return response.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        }
        throw new Error('Invalid response from tmpfiles.org');
    } finally {
        try { fs.unlinkSync(tempFile); } catch (_) {}
    }
}

// Use Wolf API to convert a public URL to Catbox URL
async function uploadViaWolfApi(fileUrl) {
    const apiUrl = `https://apis.xwolf.space/api/url/catbox?url=${encodeURIComponent(fileUrl)}`;
    const response = await axios.get(apiUrl, { timeout: 120000 });
    if (response.data?.success && response.data?.result?.url) {
        return response.data.result.url;
    }
    throw new Error('Wolf API failed: ' + (response.data?.message || 'Unknown error'));
}

// Main export: upload a buffer and get Catbox URL
async function uploadToCDN(buffer, fileName, mimeType) {
    const tempUrl = await uploadToTmpFiles(buffer, fileName);
    const catboxUrl = await uploadViaWolfApi(tempUrl);
    return catboxUrl;
}

module.exports = { uploadToCDN };