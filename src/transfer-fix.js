'use strict';

const { log } = require('./utils');

const RESOURCE_PACK_RESULTS = { SUCCESSFULLY_LOADED: 0, DECLINED: 1, FAILED_DOWNLOAD: 2, ACCEPTED: 3 };

function attachTransferFix(bot, cfg) {
  const client = bot?._client;
  if (!client || client._auctionTransferFixAttached) return;
  client._auctionTransferFixAttached = true;
  bot.on('resourcePack', (...args) => {
    const stateName = String(client.state || '').toLowerCase();
    const uuidObj = args.find((value) => value && typeof value === 'object' && typeof value.ascii === 'string');
    const uuid = uuidObj?.ascii || args.find((value) => typeof value === 'string');
    log('RESOURCE_PACK', `state=${stateName || 'unknown'} uuid=${uuid || 'none'} mode=${cfg.acceptTransferResourcePack ? 'accept' : 'deny'}`);
    if (stateName !== 'configuration' && !bot._transferInProgress) return;
    if (cfg.acceptTransferResourcePack && typeof bot.acceptResourcePack === 'function') return bot.acceptResourcePack();
    if (uuid && typeof client.write === 'function') client.write('resource_pack_receive', { uuid, result: cfg.acceptTransferResourcePack ? RESOURCE_PACK_RESULTS.ACCEPTED : RESOURCE_PACK_RESULTS.DECLINED });
  });
  client.on('packet', (data, meta = {}) => {
    if (meta.name === 'start_configuration') bot._transferInProgress = true;
    if (meta.name === 'finish_configuration') bot._transferInProgress = false;
    if (cfg.debugPackets && ['open_window', 'window_items', 'set_slot'].includes(meta.name)) log('PACKET', `${meta.name}: windowId=${data?.windowId ?? 'n/a'} slots=${data?.slots?.length ?? 'n/a'}`);
  });
}

module.exports = { attachTransferFix };
