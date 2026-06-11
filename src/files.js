'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return fallback;
  return JSON.parse(text);
}

function writeJson(file, value) {
  ensureDir(file);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendJsonl(file, value) {
  ensureDir(file);
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

module.exports = { appendJsonl, readJson, readLines, writeJson };
