'use strict';
const sdk = require('indy-sdk');
const indy = require('../index.js');
const config = require('../../init/env');

exports.createDid = async function (wallet, didInfoParam) {
    let didInfo = didInfoParam || {};
    return await sdk.createAndStoreMyDid(wallet, didInfo);
};

exports.createStewardDid = async function() {

  let stewardWallet = await indy.wallet.get();
  let stewardDidInfo = {
      'seed': config.STEWARD_SEED
  };

  [stewardDid, stewardKey] = await sdk.createAndStoreMyDid(stewardWallet, stewardDidInfo);

}

exports.getEndpointDid = async function(wallet) {
    if(!endpointDid) {
        let dids = await sdk.listMyDidsWithMeta(wallet);
        for (let didinfo of dids) {
            let meta = JSON.parse(didinfo.metadata);
            if (meta && meta.primary) {
                endpointDid = didinfo.did;
            }
        }
        if(!endpointDid) {
            await exports.createEndpointDid(wallet);
        }
    }
    return endpointDid;
};

exports.createEndpointDid = async function (wallet) {

    [endpointDid, publicVerkey] = await sdk.createAndStoreMyDid(wallet, {});
    let didMeta = JSON.stringify({
        primary: true,
        schemas: [],
        credential_definitions: []
    });
    await sdk.setDidMetadata(wallet, endpointDid, didMeta);

    await indy.pool.sendNym(await indy.pool.get(), stewardWallet, stewardDid, endpointDid, publicVerkey, "TRUST_ANCHOR");
    await indy.pool.setEndpointForDid(endpointDid, config.SERVER_HOSTNAME);
    await indy.crypto.createMasterSecret();

};

exports.setEndpointDidAttribute = async function (wallet, attribute, item) {
    let metadata = await sdk.getDidMetadata(wallet, endpointDid);
    metadata = JSON.parse(metadata);
    metadata[attribute] = item;
    await sdk.setDidMetadata(wallet, endpointDid, JSON.stringify(metadata));
};


exports.pushEndpointDidAttribute = async function (wallet, attribute, item) {
    let metadata = await sdk.getDidMetadata(wallet, endpointDid);
    metadata = JSON.parse(metadata);
    if (!metadata[attribute]) {
        metadata[attribute] = [];
    }
    metadata[attribute].push(item);
    await sdk.setDidMetadata(wallet, endpointDid, JSON.stringify(metadata));
};

exports.getEndpointDidAttribute = async function (wallet, attribute) {
    let metadata = await sdk.getDidMetadata(wallet, endpointDid);
    metadata = JSON.parse(metadata);
    return metadata[attribute];
};

exports.getTheirEndpointDid = async function (wallet, theirDid) {
    let pairwise = await sdk.getPairwise(wallet, theirDid);
    let metadata = JSON.parse(pairwise.metadata);
    return metadata.theirEndpointDid;
};