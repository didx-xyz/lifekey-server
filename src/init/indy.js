
'use strict'

var env = require('./lifeqienv')()
var indy = require('indy-sdk')

var listWallets = async function () {
  var list = await indy.listWallets()
  console.log(`Wallets = ${JSON.stringify(list)}`)
}

module.exports = async function(refresh) {
  
  //sovrin genesis, pool, connection and wallet setup - with a view that this will be a wallet on the user's cloud agent.
  initializePool(function(){
    initializeSteward(function(){})
  }).then().catch(console.error)
  return env
}

async function initializePool(callback){
  await require('./pool').get(env.GENESIS_FILE, env.POOL_NAME, env.PROTOCOL_VERSION, function(error, poolHandle){
    if(!error){
      env.POOL_HANDLE = poolHandle
      listWallets()
      callback()
  }else{
    throw Error(error)
  }
  })
}

async function initializeSteward(){
  await require('./wallet').get(env.POOL_NAME, env.WALLET_NAME, env.STEWARD_WALLET_CREDENTIALS).then(function(walletHandle){
    if(!(env.STEWARD_DID || env.STEWARD_VER_KEY)){
      console.log("listing dids")
       indy.listMyDidsWithMeta(walletHandle, function(dids){
        console.log(dids)
       })
      setupStewardDid(walletHandle)
    }
  }).catch(console.log)
}


async function setupStewardDid(walletHandle){
  console.log("===================================");
  console.log("\"Sovrin Steward\"  ->   Create DID");
  console.log("-----------------------------------");
  console.log(`Steward Wallet Open?: ${walletHandle>=0}`)
  console.log("\"Sovrin Steward\" -> Create and store in Wallet DID from seed");
  env.STEWARD_WALLET_HANDLE = walletHandle  
  let stewardDidInfo = {
      'seed': env.STEWARD_SEED
  };
  try{
    [env.STEWARD_DID, env.STEWARD_VER_KEY] = await indy.createAndStoreMyDid(env.STEWARD_WALLET_HANDLE, stewardDidInfo);
  } catch (e) {
    if(e.message !== "DidAlreadyExistsError") {
      throw e;
    }
  }finally{
    console.log(`env.STEWARD_DID = ${env.STEWARD_DID}, env.STEWARD_VER_KEY = ${env.STEWARD_VER_KEY}`)
    await indy.closeWallet(walletHandle).catch(console.error)
  }
}
