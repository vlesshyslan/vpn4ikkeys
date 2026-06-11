'use strict';

function clean(value) {
  return String(value ?? '').replace(/§[0-9a-fk-or]/gi, '').replace(/&[0-9a-fk-or]/gi, '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || !'{["'.includes(text[0])) return value;
  try { return JSON.parse(text); } catch (_) { return value; }
}

function unwrap(value) {
  while (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) value = value.value;
  return value;
}

function textOf(input) {
  if (input == null) return '';
  const value = parseJson(unwrap(input));
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean' || value == null) return '';
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (typeof value === 'object') {
    let result = '';
    for (const key of ['text', 'extra', 'with', 'translate', 'selector']) {
      if (value[key] !== undefined && value[key] !== null && value[key] !== false) result += textOf(value[key]);
    }
    if (value.score?.value !== undefined && value.score.value !== null) result += textOf(value.score.value);
    return result;
  }
  return String(value);
}

function entries(components) {
  if (!components) return [];
  if (components instanceof Map) return [...components.entries()].map(([type, data]) => ({ type, data }));
  if (Array.isArray(components)) return components;
  if (typeof components === 'object') return Object.entries(components).map(([type, data]) => ({ type, data }));
  return [];
}

function stable(value) {
  value = unwrap(value);
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = stable(value[key]);
    return acc;
  }, {});
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
const time = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
const log = (scope, msg) => console.log(`[${time()}] [${scope}] ${msg}`);
const errMsg = (error) => String(error?.message || error || '');
const fmt = (num) => Number(num || 0).toLocaleString('ru-RU');

function isNoise(error) {
  const message = errMsg(error).toLowerCase();
  return error?.partialReadError === true || ['partialreaderror', 'partial packet', 'unexpected end of data', 'varint is too big'].some((x) => message.includes(x));
}

module.exports = { clean, entries, errMsg, fmt, isNoise, log, stable, textOf, unwrap, wait };
