
'use strict'

var crypto = require('crypto')

var secp = require('secp256k1')

var env = require('./env')()

var isw = require('identity-service-wrapper')(env.EIS_HOST)

// [16:00]  
// Stephan Bothma `signer_key` will be your key (or keys) — it doesn't get used in the flow after spawning.
// `admin_addr` will be _our_ key (or smart contract), which can only work with DDO/Did info, 
// and `owner_addr` will be the key that controls the wallet features, that belong to the user.

function new_keypair() {
  do {
    var privatekey = crypto.rng(32)
  } while (!secp.privateKeyVerify(privatekey))
  return [privatekey, secp.publicKeyCreate(privatekey)]
}

require('./database')(false).then(function(database) {
  var {user, crypto_key} = database.models
  var did
  process.on('message', function(msg) {
    // TODO error case
    if (!msg.did_allocation_request) return

    // generate the eis signing key
    var {user_id, device_id} = msg.did_allocation_request
    var [privatekey, publickey] = new_keypair()
    crypto_key.create({
      owner_id: user_id,
      algorithm: 'secp256k1',
      purpose: 'sign,verify',
      alias: 'eis',
      private_key: privatekey,
      public_key: publickey
    }).then(function(created) {
      if (!created) {
        return Promise.reject('unable to create crypto_key record')
      }

      // TODO use the key to create the eis record

      // set a fake and random did for now
      did = crypto.rng(32).toString('hex')
      return user.update({did: did}, {where: {id: user_id}})
    }).then(function() {
      process.send({push_notification_request: {
        user_id: user_id,
        device_id: device_id,
        data: {received_did: true, did_value: did}
      }})
    }).catch(function(err) {
      console.log('error occurred during eis registration', err)
    })
  }).send({ready: true})
  
})