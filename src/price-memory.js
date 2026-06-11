'use strict';

const { fmt } = require('./utils');

function emptyMemory() {
  return { version: 1, createdAt: new Date().toISOString(), updatedAt: null, items: {} };
}

function normalizeMemory(value) {
  const memory = value && typeof value === 'object' ? value : emptyMemory();
  if (!memory.items || typeof memory.items !== 'object') memory.items = {};
  return memory;
}

function upsertFromLots(memory, query, lots, discountPercent) {
  let changed = 0;
  const factor = 1 - (discountPercent / 100);
  for (const lot of lots) {
    if (!lot.priceEach || lot.priceEach <= 0) continue;
    const old = memory.items[lot.uniqueKey];
    if (!old || lot.priceEach < old.minPriceEach) {
      memory.items[lot.uniqueKey] = {
        uniqueKey: lot.uniqueKey,
        identityHash: lot.identityHash,
        displayName: lot.displayName,
        typeName: lot.typeName,
        type: lot.type,
        metadata: lot.metadata,
        searchQuery: query,
        minPriceEach: lot.priceEach,
        targetBuyPriceEach: Math.floor(lot.priceEach * factor),
        bestLot: lot,
        updatedAt: new Date().toISOString()
      };
      changed += 1;
    }
  }
  memory.updatedAt = new Date().toISOString();
  return changed;
}

function findDeal(memory, lot) {
  const record = memory.items[lot.uniqueKey];
  if (!record || !lot.priceEach) return null;
  if (lot.priceEach > record.targetBuyPriceEach) return null;
  return {
    lot,
    record,
    discount: Math.round((1 - (lot.priceEach / record.minPriceEach)) * 100),
    message: `${lot.displayName} x${lot.count} ${fmt(lot.priceEach)}/шт <= ${fmt(record.targetBuyPriceEach)}/шт (база ${fmt(record.minPriceEach)}/шт)`
  };
}

module.exports = { emptyMemory, findDeal, normalizeMemory, upsertFromLots };
