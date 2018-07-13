
var indy = require('indy-sdk')
var env = require('./lifeqienv')()

let poolHandle;
let retries = 0;

exports.get = async function(genesisPoolFile, poolName, protocolVersion, callback) {
  if(!poolHandle) {
      await setup(genesisPoolFile, poolName, protocolVersion, callback);
      await open(poolName, callback)
  }
  return poolHandle;
};


async function open(poolName, callback) {
  console.log("=============================");
  console.log(`======  Opening up pool ${poolName} =====`);
  console.log("-----------------------------");
  try{
    //await indy.closePoolLedger(env.POOL_NAME)
    // poolHandle = await indy.openPoolLedger(env.POOL_NAME)
    // console.log(`======   Pool  ${poolHandle?poolHandle:'NOTHING HERE'}  =====`);
    
    await indy.openPoolLedger(poolName, null, function(error, poolHandle){

      console.log("=============================");
      console.log(`======   Pool ${error?'CLOSED':'OPENED'} ${poolHandle?poolHandle:''} ${error?('Error: '+error):''}  =====`);
      console.log("-----------------------------");
      callback(error, poolHandle)
    });
    
  } catch (e) {
    console.error(e)
    callback(e, null)
  }
  
}

async function setup(genesisPoolFile, poolName, protocolVersion) {
  
  let poolConfig = {
    "genesis_txn": genesisPoolFile
  };
  try {
    console.log("=============================");
    console.log(`======  Setting up pool =====`);
    console.log("-----------------------------");
    console.log(`poolConfig = ${genesisPoolFile}`)
    console.log(`pool NAME = ${poolName}`)
//    await indy.deletePoolLedgerConfig(env.POOL_NAME)
    try{
      console.log(`setting protocol version`)
      await indy.setProtocolVersion(parseInt(protocolVersion))
      console.log(`createPoolLedgerConfig`)
      retries = 0;
    await indy.createPoolLedgerConfig(env.POOL_NAME, poolConfig);
    } catch (e) {
      if (e.message !== "CommonIOError" || retries > 3) {
        throw e;
    }
      retries++;
      console.log(`createPoolLedgerConfig: Retry nr ${retries}`)
      return await setup(genesisPoolFile);
    }
    

  } catch (e) {
      if (e.message !== "PoolLedgerConfigAlreadyExistsError") {
          throw e;
      }
  }
};