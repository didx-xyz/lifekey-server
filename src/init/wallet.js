'use strict';
const indy = require('indy-sdk');

let wallet;


exports.get = async function() {
  if(!wallet) {
      throw Error("WALLET NOT SETUP")
  }
  return wallet;
};
exports.get = async function(pool_name, wallet_name, credentials) {
    if(!wallet) {
        await setup(pool_name, wallet_name, credentials);
    }
    return wallet;
};

async function setup(pool_name, wallet_name, credentials) {
    try {
      console.log("===================================");
      console.log("        Create wallet");
      console.log("-----------------------------------");
      await indy.createWallet(pool_name, wallet_name, "default", null, credentials)
    } catch (e) {
        if (e.message !== "WalletAlreadyExistsError") {
            throw e;
        }
    } finally {
      console.log("===================================");
      console.log("        Open wallet");
      console.log("-----------------------------------");
      wallet = await indy.openWallet(wallet_name, null, credentials).catch(console.error);
    }
};

async function close() {
  await wallet.close()
}