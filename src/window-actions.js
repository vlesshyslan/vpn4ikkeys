'use strict';

const { clean, errMsg, log, textOf, wait } = require('./utils');
const { componentLore, componentName, nbtLore, parseItem } = require('./item-parser');

function itemText(item) {
  if (!item) return '';
  const lore = [...componentLore(item), ...nbtLore(item)].join(' ');
  return clean(`${componentName(item) || ''} ${textOf(item.displayName) || ''} ${item.name || ''} ${lore}`).toLowerCase();
}

function isRefreshItem(item) {
  if (!item) return false;
  const text = itemText(item);
  if (['nether_star', 'clock', 'sunflower'].includes(item.name)) return true;
  return ['обновить', 'обновление', 'refresh', 'update', 'reload', '⟳', '↻', '↺'].some((word) => text.includes(word));
}

function findRefreshButton(window) {
  const preferred = [49, 53, 50, 48, 45, 46, 52];
  for (const slot of preferred) {
    if (isRefreshItem(window?.slots?.[slot])) return slot;
  }
  for (let slot = 0; slot < (window?.slots?.length || 0); slot += 1) {
    if (isRefreshItem(window.slots[slot])) return slot;
  }
  return 49;
}

function isConfirmItem(item) {
  if (!item) return false;
  const name = String(item.name || '').toLowerCase();
  const text = itemText(item);
  return name === 'lime_stained_glass_pane' || name === 'green_stained_glass_pane' || name === 'stained_glass_pane' || text.includes('подтверд') || text.includes('купить') || text.includes('confirm');
}

function findConfirmSlots(window) {
  const result = [];
  for (let slot = 0; slot < (window?.slots?.length || 0); slot += 1) {
    if (isConfirmItem(window.slots[slot])) result.push(slot);
  }
  return result;
}

async function leftClick(bot, slot, label, delayMs = 0) {
  const simple = bot.simpleClick?.leftMouse;
  log('CLICK', `${label || 'slot'} slot=${slot}`);
  if (typeof simple === 'function') await simple.call(bot.simpleClick, slot);
  else await bot.clickWindow(slot, 0, 0);
  if (delayMs > 0) await wait(delayMs);
}

async function safeLeftClick(bot, slot, label, delayMs = 0) {
  try {
    await leftClick(bot, slot, label, delayMs);
    return true;
  } catch (error) {
    log('CLICK', `failed ${label || slot}: ${errMsg(error)}`);
    return false;
  }
}

function waitForWindow(bot, predicate, timeoutMs) {
  return new Promise((resolve) => {
    const current = bot.currentWindow;
    if (current && (!predicate || predicate(current))) return resolve(current);
    const timer = setTimeout(done, timeoutMs, null);
    function done(window) {
      clearTimeout(timer);
      bot.removeListener('windowOpen', onOpen);
      resolve(window);
    }
    function onOpen(window) {
      if (!predicate || predicate(window)) done(window);
    }
    bot.on('windowOpen', onOpen);
  });
}

async function clickRefresh(bot, window, cfg) {
  const slot = findRefreshButton(bot.currentWindow || window);
  const ok = await safeLeftClick(bot, slot, 'refresh', cfg.clickDelayMs);
  if (!ok) return false;
  return true;
}

async function buyLot(bot, lot, cfg) {
  await leftClick(bot, lot.slot, `deal ${lot.displayName} ${lot.priceEach}`, cfg.clickDelayMs);
  const confirmWindow = await waitForWindow(bot, (window) => findConfirmSlots(window).length > 0, cfg.confirmTimeoutMs);
  const active = confirmWindow || bot.currentWindow;
  const confirmSlots = findConfirmSlots(active);
  if (!confirmSlots.length) {
    log('BUY', `confirmation not found for ${lot.displayName}`);
    return false;
  }
  await leftClick(bot, confirmSlots[0], `confirm ${lot.displayName}`, cfg.clickDelayMs);
  log('BUY', `clicked buy confirmation slot=${confirmSlots[0]} item=${lot.displayName} priceEach=${lot.priceEach}`);
  return true;
}

function describeWindow(window) {
  const items = [];
  for (let slot = 0; slot < (window?.slots?.length || 0); slot += 1) {
    const item = window.slots[slot];
    if (!item) continue;
    const lot = parseItem(item, slot);
    items.push(`${slot}:${lot.displayName}/${item.name}`);
  }
  return items.join(', ');
}

module.exports = { buyLot, clickRefresh, describeWindow, findConfirmSlots, findRefreshButton, safeLeftClick, waitForWindow };
