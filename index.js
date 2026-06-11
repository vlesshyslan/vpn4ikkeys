'use strict';

const mineflayer = require('mineflayer');
const cfg = require('./config');
const { AuctionRunner } = require('./src/auction-runner');
const { attachTransferFix } = require('./src/transfer-fix');
const { errMsg, isNoise, log, wait } = require('./src/utils');

const bot = mineflayer.createBot({
  host: cfg.host,
  port: cfg.port,
  username: cfg.username,
  version: cfg.version,
  compiled: Boolean(cfg.compiledProtocol),
  hideErrors: true,
  logErrors: false
});

attachTransferFix(bot, cfg);
let runner = null;
let started = false;
let authSent = false;

bot.on('login', () => log('GENERAL', `Connected as ${cfg.username} state=${bot._client?.state || 'unknown'}`));

bot.once('spawn', async () => {
  log('GENERAL', `Spawned at ${cfg.host}`);
  if (started) return;
  started = true;
  runner = new AuctionRunner(bot, cfg);
  await runner.run().catch((error) => log('GENERAL', `runner error: ${errMsg(error)}`));
});

bot.on('message', async (message) => {
  const raw = message?.toString ? message.toString() : String(message ?? '');
  log('MESSAGE', raw);
  const lower = raw.toLowerCase();
  const needLogin = lower.includes('/login') || lower.includes('войдите') || lower.includes('введите пароль') || lower.includes('авторизуйтесь') || (lower.includes('авториз') && !lower.includes('уже авторизованы'));
  if (cfg.password && !authSent && needLogin) {
    authSent = true;
    await wait(cfg.loginDelayMs);
    runner?.safeChat(`/login ${cfg.password}`);
  }
});

bot.on('kicked', (reason) => {
  log('GENERAL', `Kicked: ${typeof reason === 'object' ? JSON.stringify(reason).slice(0, 300) : String(reason)}`);
  runner?.stop('kicked');
});

bot.on('error', (error) => { if (!isNoise(error)) log('GENERAL', `Error: ${errMsg(error)}`); });

bot.on('end', (reason) => {
  log('GENERAL', `Disconnected reason=${reason}`);
  runner?.stop(`end:${reason}`);
});

process.on('SIGINT', () => {
  runner?.stop('sigint');
  bot.quit('SIGINT');
  process.exit(0);
});

process.on('uncaughtException', (error) => { if (!isNoise(error)) log('GENERAL', `uncaughtException=${errMsg(error)}`); });
process.on('unhandledRejection', (error) => { if (!isNoise(error)) log('GENERAL', `unhandledRejection=${errMsg(error)}`); });

log('START', `${cfg.username}@${cfg.host}:${cfg.port} version=${cfg.version || 'auto'}`);
log('START', `scan /ah search list -> save min*${100 - cfg.dealDiscountPercent}% -> monitor /ah refresh=${cfg.updateIntervalMs}ms autobuy=${cfg.autoBuy}`);
