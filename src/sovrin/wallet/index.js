'use strict';
const sdk = require('indy-sdk');
const config = require('../../../init/env');
let wallet;

module.exports = [
  get = async function () {
    if (!wallet) {
      await exports.setup();
    }
    return wallet;
  },
  setup = async function () {
    try {
      await sdk.createWallet(config.POOL_NAME, config.WALLET_NAME);
    } catch (e) {
      if (e.message !== "WalletAlreadyExistsError") {
        throw e;
      }
    } finally {
      wallet = await sdk.openWallet(config.WALLET_NAME);
    }
  },
  setupNewWalletForUser = async function (user_id) {
    try {
      await sdk.createWallet(config.POOL_NAME, `${user_id}_USER_WALLET`);
    } catch (e) {
      if (e.message !== "WalletAlreadyExistsError") {
        throw e;
      }
    } finally {
      wallet = await sdk.openWallet(config.WALLET_NAME);
      return wallet
    }
  },
  openWalletForUser = async function (user_id) {
    return await sdk.openWallet(`${user_id}_USER_WALLET`, {"key": '\"' + config.WALLET_KEY + '\"'});
  }

]

