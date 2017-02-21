
'use strict'

var crypto = require('crypto')

var secp = require('secp256k1')

var NODE_ENV = process.env.NODE_ENV || 'development'
var env

try {
  env = require(`../../etc/env/${NODE_ENV}.env.json`)
} catch (e) {
  // ENOENT
  throw new Error(`unable to find matching env file for ${NODE_ENV}`)
}

var isw = require('identity-service-wrapper')(env.EIS_HOST)

// [16:00]  
// Stephan Bothma `signer_key` will be your key (or keys) — it doesn't get used in the flow after spawning.
// `admin_addr` will be _our_ key (or smart contract), which can only work with DDO/Did info, and
// `owner_addr` will be the key that controls the wallet features, that belong to the user.

function new_keypair() {
  do {
    var privatekey = crypto.rng(32)
  } while (!secp.privateKeyVerify(privatekey))
  return [privatekey, secp.publicKeyCreate(privatekey)]
}

require('./database')(false).then(function(database) {
  var {user, crypto_key} = database.models
  process.on('message', function(msg) {
    // TODO error case
    if (!msg.did_allocation_request) return

    // generate the eis signing key
    var {userid} = msg.did_allocation_request
    var [privatekey, publickey] = new_keypair()
    crypto_key.create({
      owner_id: userid,
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
    }).catch(function(err) {
      console.log('error occurred during eis registration', err)
    })
  }).send({ready: true})
  
})