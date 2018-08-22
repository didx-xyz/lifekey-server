'use strict';
const config = require('../init/env');

exports.wallet = require('./wallet');
exports.did = require('./did');
exports.pairwise = require('./pairwise');
exports.pool = require('./pool');


module.exports = [
  
    setupAgent = async function () {
      await exports.pool.setup();
      await exports.wallet.setup();
      let endpointDid = await exports.did.getEndpointDid(); // Creates it if it doesn't exist
      await exports.pool.setEndpointForDid(endpointDid, config.SERVER_HOSTNAME);
      return Promise.resolve();
  },
  createNewDid = async function (user_id) {
    await exports.pool.get();
    await exports.wallet.setup();
    let endpointDid = await exports.did.getEndpointDid(); // Creates it if it doesn't exist
    await exports.pool.setEndpointForDid(endpointDid, config.SERVER_HOSTNAME);
    return Promise.resolve();
}
]

















