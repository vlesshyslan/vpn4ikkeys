'use strict';

const path = require('path');

const bool = (name, fallback) => process.env[name] === undefined ? fallback : process.env[name] !== '0';
const num = (name, fallback) => Number(process.env[name] ?? fallback);
const list = (name, fallback = '') => String(process.env[name] || fallback).split(',').map((x) => x.trim()).filter(Boolean);

module.exports = {
  host: process.env.SPOOKY_HOST || 'spookytime.net',
  port: num('SPOOKY_PORT', 25565),
  version: process.env.MC_VERSION || '1.21.11',
  compiledProtocol: bool('MC_COMPILED_PROTOCOL', true),
  username: process.env.BOT_USERNAME || 'AuctionBot',
  password: process.env.BOT_PASSWORD || '',
  targetAn: process.env.TARGET_AN || '501',

  itemsFile: process.env.AH_ITEMS_FILE || path.join(__dirname, 'items.txt'),
  memoryFile: process.env.AH_MEMORY_FILE || path.join(__dirname, 'data', 'price-memory.json'),
  dealsFile: process.env.AH_DEALS_FILE || path.join(__dirname, 'data', 'deals.jsonl'),
  reportFile: process.env.AH_REPORT_FILE || path.join(__dirname, 'data', 'last-run.json'),

  ahSearchQueries: list('AH_SEARCH_QUERIES', process.env.AH_SEARCH_QUERY || 'Серебро'),
  dealDiscountPercent: num('DEAL_DISCOUNT_PERCENT', 20),

  registerDelayMs: num('REGISTER_DELAY_MS', 1000),
  loginDelayMs: num('LOGIN_DELAY_MS', 1500),
  anCommandDelayMs: num('AN_COMMAND_DELAY_MS', 1800),
  firstAhDelayMs: num('AH_SEARCH_DELAY_MS', 12000),
  searchCooldownMs: num('AH_SEARCH_COOLDOWN_MS', 1000),
  windowReadDelayMs: num('WINDOW_READ_DELAY_MS', 200),
  commandWindowTimeoutMs: num('COMMAND_WINDOW_TIMEOUT_MS', 6000),
  updateIntervalMs: num('AH_REFRESH_INTERVAL_MS', 250),
  clickDelayMs: num('CLICK_DELAY_MS', 100),
  confirmTimeoutMs: num('CONFIRM_TIMEOUT_MS', 2500),
  refreshRescanEvery: num('REFRESH_RESCAN_EVERY', 20),

  antiAfkEnabled: bool('ANTI_AFK_ENABLED', true),
  antiAfkIntervalMs: num('ANTI_AFK_INTERVAL_MS', 40000),
  antiAfkWalkMs: num('ANTI_AFK_WALK_MS', 1000),

  acceptTransferResourcePack: bool('ACCEPT_TRANSFER_RESOURCE_PACK', true),
  autoBuy: bool('AH_AUTO_BUY', true),
  debugPackets: bool('DEBUG_PACKETS', false),
  debugLots: bool('DEBUG_LOTS', false)
};
