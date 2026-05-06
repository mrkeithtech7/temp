// ─────────────────────────────────────────────────
//  lib/api.js
//  MOON-X V2 — Centralized API Configuration
//  All GiftedTech API endpoints in one place
//  Keith Tech © 2026
// ─────────────────────────────────────────────────

'use strict';

const API_KEY  = '_0u5aff45,_0l1876s8qc';
const BASE_URL = 'https://api.giftedtech.co.ke/api';

const API = {
  key: API_KEY,
  base: BASE_URL,

  // ── AI ──────────────────────────────────────────
  ai: {
    gemini:  (q)             => `${BASE_URL}/ai/gemini?apikey=${API_KEY}&q=${encodeURIComponent(q)}`,
    chatbot: (q, prompt)     => `${BASE_URL}/ai/custom?apikey=${API_KEY}&q=${encodeURIComponent(q)}&prompt=${encodeURIComponent(prompt)}`,
    txt2img: (prompt)        => `${BASE_URL}/ai/txt2img?apikey=${API_KEY}&prompt=${encodeURIComponent(prompt)}`,
  },

  // ── Tools ────────────────────────────────────────
  tools: {
    web2zip:  (url)          => `${BASE_URL}/tools/web2zip?apikey=${API_KEY}&url=${encodeURIComponent(url)}`,
    dnsCheck: (domain)       => `${BASE_URL}/tools/dns-check?apikey=${API_KEY}&domain=${encodeURIComponent(domain)}`,
  },

  // ── Search ───────────────────────────────────────
  search: {
    google:    (query)       => `${BASE_URL}/search/google?apikey=${API_KEY}&query=${encodeURIComponent(query)}`,
    lyrics:    (query)       => `${BASE_URL}/search/lyricsv2?apikey=${API_KEY}&query=${encodeURIComponent(query)}`,
    wallpaper: (query)       => `${BASE_URL}/search/wallpaper?apikey=${API_KEY}&query=${encodeURIComponent(query)}`,
    npm:       (pkg)         => `${BASE_URL}/search/npmsearch?apikey=${API_KEY}&packagename=${encodeURIComponent(pkg)}`,
  },

  // ── Stalk ────────────────────────────────────────
  stalk: {
    waChannel: (url)         => `${BASE_URL}/stalk/wachannel?apikey=${API_KEY}&url=${encodeURIComponent(url)}`,
  },
};

module.exports = API;
