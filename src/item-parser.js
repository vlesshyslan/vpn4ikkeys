'use strict';

const crypto = require('crypto');
const { clean, entries, stable, textOf, unwrap } = require('./utils');

const compType = (component) => String(component?.type || component?.name || component?.key || '').replace(/^minecraft:/, '').toLowerCase();
const compData = (component) => Object.prototype.hasOwnProperty.call(component || {}, 'data') ? component.data : unwrap(component?.value ?? component);
const lineText = (line) => clean(textOf(line));

function nbtRoot(nbt) { return nbt?.value || nbt || {}; }
function nbtDisplay(item) { return nbtRoot(item?.nbt).display?.value || nbtRoot(item?.nbt).display || {}; }
function nbtLore(item) {
  const lore = nbtDisplay(item).Lore?.value?.value || nbtDisplay(item).Lore?.value || nbtDisplay(item).Lore || [];
  return (Array.isArray(lore) ? lore : [lore]).map(lineText).filter(Boolean);
}
function nbtName(item) { return lineText(nbtDisplay(item).Name?.value || nbtDisplay(item).Name) || null; }

function componentLore(item) {
  return entries(item?.components).flatMap((component) => {
    if (compType(component) !== 'lore') return [];
    const data = unwrap(compData(component));
    const lines = Array.isArray(data) ? data : (Array.isArray(data?.lines) ? data.lines : [data]);
    return lines.map(lineText).filter(Boolean);
  });
}

function componentName(item) {
  for (const component of entries(item?.components)) {
    if (!['custom_name', 'item_name'].includes(compType(component))) continue;
    const name = lineText(compData(component));
    if (name) return name;
  }
  return null;
}

function flattenNbt(value) {
  value = unwrap(value);
  if (Array.isArray(value)) return value.map(flattenNbt);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, flattenNbt(val)]));
}

function hiddenData(item) {
  const hidden = {};
  for (const component of entries(item?.components)) {
    const type = compType(component);
    if (type === 'custom_data') Object.assign(hidden, flattenNbt(compData(component)) || {});
    if (['custom_model_data', 'damage', 'enchantments', 'attribute_modifiers', 'potion_contents', 'profile', 'trim', 'stored_enchantments'].includes(type)) hidden[type] = flattenNbt(compData(component));
  }
  Object.assign(hidden, flattenNbt(nbtRoot(item?.nbt).PublicBukkitValues) || {});
  Object.assign(hidden, flattenNbt(nbtRoot(item?.nbt).PublicBukkitValues?.value) || {});
  return hidden;
}

function findNumber(text) {
  const match = clean(text).match(/[\d\s.,]+/);
  const number = match && Number.parseInt(match[0].replace(/\D/g, ''), 10);
  return Number.isSafeInteger(number) ? number : null;
}

function fromLore(lore, patterns) {
  for (const line of lore) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return match[1].trim();
    }
  }
  return null;
}

function priceFromLore(lore) {
  const value = fromLore(lore, [/Цен[аы]:?\s*\$?([\d\s.,]+)/i, /Стоимость:?\s*\$?([\d\s.,]+)/i, /\$\s*([\d\s.,]+)/, /([\d\s.,]+)\s*(?:монет|coins?)/i]);
  return value ? findNumber(value) : null;
}

function identityHash(parts) {
  return crypto.createHash('sha1').update(JSON.stringify(stable(parts))).digest('hex').slice(0, 16);
}

function parseItem(item, slot) {
  const lore = [...new Set([...componentLore(item), ...nbtLore(item)])];
  const displayName = clean(componentName(item) || nbtName(item) || textOf(item?.displayName) || item?.name) || 'unknown_item';
  const hidden = hiddenData(item || {});
  const fullPrice = priceFromLore(lore);
  const count = item?.count || 1;
  const typeName = item?.name || 'unknown_type';
  const identity = {
    displayName,
    typeName,
    type: item?.type || 0,
    metadata: item?.metadata || 0,
    customModelData: hidden.custom_model_data || hidden.CustomModelData || null,
    potion: hidden.potion_contents || hidden.Potion || null,
    enchants: hidden.enchantments || hidden.stored_enchantments || null,
    currency: hidden['spookystash:currency'] || null
  };
  const uniqueKey = `${displayName}|${typeName}|${identityHash(identity)}`;
  return {
    slot,
    displayName,
    typeName,
    type: item?.type || 0,
    metadata: item?.metadata || 0,
    count,
    fullPrice,
    priceEach: fullPrice && count ? Math.round((fullPrice / count) * 100) / 100 : null,
    seller: fromLore(lore, [/(?:Продавец|Seller|Владелец):?\s*(.+)$/i]) || 'unknown',
    timeLeft: fromLore(lore, [/(?:Ист[еёe]кает|Осталось|До конца|Expires):?\s*(.+)$/i]) || 'unknown',
    lore,
    hiddenData: hidden,
    uniqueKey,
    identityHash: identityHash(identity),
    lotId: `${uniqueKey}|${fullPrice || 0}|${count}|${slot}`
  };
}

function isAuctionLot(item, lot) {
  if (!item || item.type === 0 || item.name === 'air') return false;
  if (!lot.displayName || lot.displayName === 'unknown_item') return false;
  const badText = `${lot.displayName} ${lot.lore.join(' ')}`.toLowerCase();
  return !badText.includes('товар не актуален') && !badText.includes('истек') && lot.priceEach > 0;
}

function extractLots(window) {
  const lots = [];
  const max = Math.min(45, window?.slots?.length || 0);
  for (let slot = 0; slot < max; slot += 1) {
    const item = window?.slots?.[slot];
    const lot = parseItem(item, slot);
    if (isAuctionLot(item, lot)) lots.push(lot);
  }
  return lots;
}

module.exports = { compType, componentLore, componentName, extractLots, hiddenData, nbtLore, parseItem };
