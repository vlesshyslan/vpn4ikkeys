'use strict';

const { appendJsonl, readJson, readLines, writeJson } = require('./files');
const { extractLots } = require('./item-parser');
const { emptyMemory, findDeal, normalizeMemory, upsertFromLots } = require('./price-memory');
const { buyLot, clickRefresh, waitForWindow } = require('./window-actions');
const { errMsg, fmt, log, wait } = require('./utils');

class AuctionRunner {
  constructor(bot, cfg) {
    this.bot = bot;
    this.cfg = cfg;
    this.memory = normalizeMemory(readJson(cfg.memoryFile, emptyMemory()));
    this.phase = 'idle';
    this.monitoring = false;
    this.seenDeals = new Set();
    this.stats = { scannedQueries: 0, monitorTicks: 0, deals: 0, buys: 0, refreshFails: 0 };
  }

  queries() {
    const fromFile = readLines(this.cfg.itemsFile);
    const all = [...fromFile, ...this.cfg.ahSearchQueries];
    return [...new Set(all.map((x) => x.trim()).filter(Boolean))];
  }

  safeChat(command) {
    if (!this.bot || this.bot.state === 'disconnected') return false;
    const masked = this.cfg.password ? command.replace(this.cfg.password, '***') : command;
    log('CMD', masked);
    this.bot.chat(command);
    return true;
  }

  async authAndEnter() {
    if (this.cfg.password) {
      await wait(this.cfg.registerDelayMs);
      this.safeChat(`/reg ${this.cfg.password}`);
    }
    await wait(this.cfg.anCommandDelayMs);
    this.safeChat(`/an${this.cfg.targetAn}`);
    await wait(this.cfg.firstAhDelayMs);
  }

  async openCommandWindow(command) {
    if (this.bot.currentWindow) this.bot.closeWindow(this.bot.currentWindow);
    await wait(50);
    this.safeChat(command);
    const window = await waitForWindow(this.bot, null, this.cfg.commandWindowTimeoutMs);
    await wait(this.cfg.windowReadDelayMs);
    return window || this.bot.currentWindow;
  }

  async scanQuery(query) {
    this.phase = 'scan';
    const window = await this.openCommandWindow(`/ah search ${query}`);
    if (!window) {
      log('SCAN', `no window for query="${query}"`);
      return 0;
    }
    const lots = extractLots(window);
    const changed = upsertFromLots(this.memory, query, lots, this.cfg.dealDiscountPercent);
    writeJson(this.cfg.memoryFile, this.memory);
    this.stats.scannedQueries += 1;
    log('SCAN', `query="${query}" lots=${lots.length} memoryUpdates=${changed}`);
    if (this.bot.currentWindow) this.bot.closeWindow(this.bot.currentWindow);
    await wait(this.cfg.searchCooldownMs);
    return changed;
  }

  async scanAll() {
    const queries = this.queries();
    log('SCAN', `start: ${queries.length} queries, cooldown=${this.cfg.searchCooldownMs}ms`);
    for (const query of queries) {
      if (this.bot.state === 'disconnected') return;
      await this.scanQuery(query);
    }
    log('SCAN', `done: memory items=${Object.keys(this.memory.items).length}`);
  }

  bestDeals(window) {
    return extractLots(window).map((lot) => findDeal(this.memory, lot)).filter(Boolean).sort((a, b) => a.lot.priceEach - b.lot.priceEach);
  }

  async handleDeals(window) {
    const deals = this.bestDeals(window);
    for (const deal of deals) {
      const key = deal.lot.lotId;
      if (this.seenDeals.has(key)) continue;
      this.seenDeals.add(key);
      this.stats.deals += 1;
      log('DEAL', `${deal.message} slot=${deal.lot.slot} seller=${deal.lot.seller} discount=${deal.discount}%`);
      appendJsonl(this.cfg.dealsFile, { at: new Date().toISOString(), deal });
      if (!this.cfg.autoBuy) continue;
      const bought = await buyLot(this.bot, deal.lot, this.cfg);
      if (bought) this.stats.buys += 1;
      await wait(this.cfg.clickDelayMs);
      break;
    }
  }

  async antiAfk() {
    if (!this.cfg.antiAfkEnabled) return;
    log('AFK', 'closing AH and walking for anti-afk');
    if (this.bot.currentWindow) this.bot.closeWindow(this.bot.currentWindow);
    await wait(100);
    this.bot.setControlState('forward', true);
    this.bot.setControlState('jump', true);
    await wait(this.cfg.antiAfkWalkMs);
    this.bot.setControlState('jump', false);
    this.bot.setControlState('forward', false);
    await wait(100);
    await this.openCommandWindow('/ah');
  }

  async monitorAllAh() {
    this.phase = 'monitor';
    this.monitoring = true;
    let window = await this.openCommandWindow('/ah');
    let lastAfk = Date.now();
    let refreshSlotRescans = 0;
    log('MONITOR', `started refresh=${this.cfg.updateIntervalMs}ms autobuy=${this.cfg.autoBuy}`);

    while (this.monitoring && this.bot.state !== 'disconnected') {
      try {
        window = this.bot.currentWindow || window;
        if (!window) {
          window = await this.openCommandWindow('/ah');
          continue;
        }

        await this.handleDeals(window);
        const refreshed = await clickRefresh(this.bot, window, this.cfg);
        if (!refreshed) this.stats.refreshFails += 1;
        refreshSlotRescans += 1;
        this.stats.monitorTicks += 1;

        if (this.stats.monitorTicks % 40 === 0) {
          log('STATUS', `ticks=${this.stats.monitorTicks} deals=${this.stats.deals} buys=${this.stats.buys} known=${Object.keys(this.memory.items).length} refreshFails=${this.stats.refreshFails}`);
        }

        if (refreshSlotRescans >= this.cfg.refreshRescanEvery) refreshSlotRescans = 0;
        if (Date.now() - lastAfk >= this.cfg.antiAfkIntervalMs) {
          await this.antiAfk();
          lastAfk = Date.now();
        }
        await wait(this.cfg.updateIntervalMs);
      } catch (error) {
        log('MONITOR', `loop error: ${errMsg(error)}`);
        await wait(this.cfg.updateIntervalMs);
      }
    }
  }

  async run() {
    await this.authAndEnter();
    await this.scanAll();
    await this.monitorAllAh();
  }

  stop(reason) {
    this.monitoring = false;
    writeJson(this.cfg.reportFile, {
      stoppedAt: new Date().toISOString(),
      reason,
      phase: this.phase,
      stats: this.stats,
      memoryItems: Object.keys(this.memory.items).length,
      cheapest: Object.values(this.memory.items).sort((a, b) => a.minPriceEach - b.minPriceEach).slice(0, 20).map((item) => ({ name: item.displayName, type: item.typeName, min: fmt(item.minPriceEach), buyBelow: fmt(item.targetBuyPriceEach) }))
    });
  }
}

module.exports = { AuctionRunner };
