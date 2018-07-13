
'use strict'


var indy = require('indy-sdk')
var wallet = require('./wallet')
var util = require('./util')
var env = require('./lifeqienv')()


/*Current
  -------
1. Mobile/Web app asks for a DID to be allocated
2. DID allocated and sent to user
3. App sends public key to be stored

Intermediate
------------
1. Mobile/Web app uses sdk to create and store DID, keys
2. Connect to pool, create and/open wallet
3. Create LifeKey Swerver DID and store in wallet - if not exists
4. Generate DID for user and send.
5. On receipt of pub key create pairwise connection to LK
6. From this point we continue as normal but use the keys store in wallet
7. 
*/

// forward references to db and eth
var  user, crypto_key, user_datum


process.on('message', process_message)

require('./database')(
  false
).then(function(database) {
  user = database.models.user
  crypto_key = database.models.crypto_key
  user_datum = database.models.user_datum
  while (process_message_backlog.length || created_did_backlog.length) {
    setImmediate(process_message, process_message_backlog.shift())
    setImmediate(created_did, null, created_did_backlog.shift())
  }
  process.send({ready: true})
}).catch(function(err) {
  console.log('did ---', err || 'no error message')
  process.send({ready: false})
})

async function process_message(msg) {
  if (!msg.did_allocation_request) return

  if (!(crypto_key || user || user_datum)) {
    process_message_backlog.push(msg)
    return
  }


  var {user_id} = msg.did_allocation_request
  
  console.log("=======================");
  console.log("== Onboarding - User ==");
  console.log("-----------------------");
  let userWalletName =`${user_id}_WALLET`
  let userWalletCredentials = {'key': `${user_id}_KEY`}
  let [userWallet, stewardUserKey, userStewardDid, userStewardKey] = await onboarding(poolHandle, poolName, "Sovrin Steward", env.STEWARD_WALLET, env.STEWARD_DID, `USER_${user_id}`, null, userWalletName, userWalletCredentials);


  console.log("==============================================================");
  console.log("== Getting Trust Anchor credentials - User getting Verinym  ==");
  console.log("--------------------------------------------------------------");

  let did_value = await getVerinym(env.POOL_HANDLE, "Sovrin Steward", env.STEWARD_WALLET, env.STEWARD_DID, stewardUserKey, `USER_${user_id}`, userWallet, userStewardDid, userStewardKey, 'TRUST_ANCHOR')
  console.log(`The DID(${did_value}) has been created for user_id ${user_id}`)
  created_did(did_value, user_id)
}

async function onboarding(poolHandle, poolName, From, fromWallet, fromDid, to, toWallet, toWalletName, toWalletCredentials) {
  console.log(`\"${From}\" > Create and store in Wallet \"${From} ${to}\" DID`);
  let [fromToDid, fromToKey] = await indy.createAndStoreMyDid(fromWallet, {});

  console.log(`\"${From}\" > Send Nym to Ledger for \"${From} ${to}\" DID`);
  await sendNym(poolHandle, fromWallet, fromDid, fromToDid, fromToKey, null);

  console.log(`\"${From}\" > Send connection request to ${to} with \"${From} ${to}\" DID and nonce`);
  let connectionRequest = {
      did: fromToDid,
      nonce: util.getRandomNounce()
  };

  if (!toWallet) {
      console.log(`\"${to}\" > Create wallet"`);
      try {
          await indy.createWallet(poolName, toWalletName, 'default', null, toWalletCredentials)
      } catch(e) {
          if(e.message !== "WalletAlreadyExistsError") {
              throw e;
          }
      }
      toWallet = await indy.openWallet(toWalletName, null, toWalletCredentials);
  }

  console.log(`\"${to}\" > Create and store in Wallet \"${to} ${From}\" DID`);
  let [toFromDid, toFromKey] = await indy.createAndStoreMyDid(toWallet, {});

  console.log(`\"${to}\" > Get key for did from \"${From}\" connection request`);
  let fromToVerkey = await indy.keyForDid(poolHandle, toWallet, connectionRequest.did);

  console.log(`\"${to}\" > Anoncrypt connection response for \"${From}\" with \"${to} ${From}\" DID, verkey and nonce`);
  let connectionResponse = JSON.stringify({
      'did': toFromDid,
      'verkey': toFromKey,
      'nonce': connectionRequest['nonce']
  });
  let anoncryptedConnectionResponse = await indy.cryptoAnonCrypt(fromToVerkey, Buffer.from(connectionResponse, 'utf8'));

  console.log(`\"${to}\" > Send anoncrypted connection response to \"${From}\"`);

  console.log(`\"${From}\" > Anondecrypt connection response from \"${to}\"`);
  let decryptedConnectionResponse = JSON.parse(Buffer.from(await indy.cryptoAnonDecrypt(fromWallet, fromToKey, anoncryptedConnectionResponse)));

  console.log(`\"${From}\" > Authenticates \"${to}\" by comparision of Nonce`);
  if (connectionRequest['nonce'] !== decryptedConnectionResponse['nonce']) {
      throw Error("nonces don't match!");
  }

  console.log(`\"${From}\" > Send Nym to Ledger for \"${to} ${From}\" DID`);
  await sendNym(poolHandle, fromWallet, fromDid, decryptedConnectionResponse['did'], decryptedConnectionResponse['verkey'], null);

  return [toWallet, fromToKey, toFromDid, toFromKey, decryptedConnectionResponse];
}


async function getVerinym(poolHandle, From, fromWallet, fromDid, fromToKey, to, toWallet, toFromDid, toFromKey, role) {
  console.log(`\"${to}\" > Create and store in Wallet \"${to}\" new DID"`);
  let [toDid, toKey] = await indy.createAndStoreMyDid(toWallet, {});

  console.log(`\"${to}\" > Authcrypt \"${to} DID info\" for \"${From}\"`);
  let didInfoJson = JSON.stringify({
      'did': toDid,
      'verkey': toKey
  });
  let authcryptedDidInfo = await indy.cryptoAuthCrypt(toWallet, toFromKey, fromToKey, Buffer.from(didInfoJson, 'utf8'));

  console.log(`\"${to}\" > Send authcrypted \"${to} DID info\" to ${From}`);

  console.log(`\"${From}\" > Authdecrypted \"${to} DID info\" from ${to}`);
  let [senderVerkey, authdecryptedDidInfo] =
      await indy.cryptoAuthDecrypt(fromWallet, fromToKey, Buffer.from(authcryptedDidInfo));

  let authdecryptedDidInfoJson = JSON.parse(Buffer.from(authdecryptedDidInfo));
  console.log(`\"${From}\" > Authenticate ${to} by comparision of Verkeys`);
  let retrievedVerkey = await indy.keyForDid(poolHandle, fromWallet, toFromDid);
  if (senderVerkey !== retrievedVerkey) {
      throw Error("Verkey is not the same");
  }

  console.log(`\"${From}\" > Send Nym to Ledger for \"${to} DID\" with ${role} Role`);
  await sendNym(poolHandle, fromWallet, fromDid, authdecryptedDidInfoJson['did'], authdecryptedDidInfoJson['verkey'], role);

  return toDid
}

async function sendNym(poolHandle, walletHandle, Did, newDid, newKey, role) {
  let nymRequest = await indy.buildNymRequest(Did, newDid, newKey, null, role);
  await indy.signAndSubmitRequest(poolHandle, walletHandle, Did, nymRequest);
}


function created_did(did, user_id) {
  user.update({
    did_address: did,
    did: did_with_urn
  }, {
    where: {id: user_id}
  }).then(function(updated) {
    if (!updated[0]) {
      return Promise.reject(
        'unable to update user ' +
        user_id +
        ' - perhaps this user no longer exists?'
      )
    }
    return user_datum.create({
      owner_id: user_id,
      entity: 'me',
      attribute: 'DID',
      alias: 'DID',
      value: JSON.stringify({
        '@context': 'http://schema.cnsnt.io/decentralised_identifier',
        decentralisedIdentifier: did_with_urn,
        createdDate: new Date,
        modifiedDate: new Date
      }),
      is_verifiable_claim: false,
      schema: 'schema.cnsnt.io/decentralised_identifier',
      mime: 'application/ld+json',
      encoding: 'utf8'
    })
  }).then(function(updated) {
    console.log('DDO updated for user', user_id)
    process.send({
      notification_request: {
        type: 'received_did',
        user_id: user_id,
        data: {
          type: 'received_did',
          received_did: true,
          did_value: did_with_urn,
          did_address: did
        },
        notification: {
          title: 'You have been allocated a decentralised identifier',
          body: 'Click here to view your DID!'
        }
      }
    })
  }).catch(console.log.bind(console, 'did --- db update error'))
}

