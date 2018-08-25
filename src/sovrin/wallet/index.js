'use strict';
const sdk = require('indy-sdk');
const config = require('../../init/env');
let wallet;

module.exports = [
  get = async function () {
    if (!wallet) {
      await exports.setupStewardWallet();
    }
    return wallet;
  },
  setupStewardWallet = async function () {
    try {
      await sdk.createWallet(config.POOL_NAME, config.STEWARD_WALLET_NAME, {"key": '\"' + STEWARD_WALLET_KEY + '\"'});
    } catch (e) {
      if (e.message !== "WalletAlreadyExistsError") {
        throw e;
      }
    } finally {
      wallet = await sdk.openWallet(config.WALLET_NAME,  {"key": '\"' + STEWARD_WALLET_KEY + '\"'});
    }
  },
  getUserWallet = async function (user_id) {
    if (!wallet) {
      await exports.setupNewWalletForUser(user_id);
    }
    return wallet;
  },
  setupUserWallet = async function (user_id) {
    try {
      await sdk.createWallet(config.POOL_NAME, `${user_id}_USER_WALLET`, {"key": '\"' + user_id + '\"'});
    } catch (e) {
      if (e.message !== "WalletAlreadyExistsError") {
        throw e;
      }
    } finally {
      wallet = await exports.openUserWallet(user_id);
      return wallet
    }
  },
  openUserWallet = async function (user_id) {
    return await sdk.openWallet(`${user_id}_USER_WALLET`, {"key": '\"' + user_id + '\"'});
  }

]

