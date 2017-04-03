
'use strict'

var crypto = require('crypto')

var secp = require('secp256k1')

var env = require('./env')()
var isw = require('identity-service-wrapper')(env.EIS_HOST)

// [16:00]  
// Stephan Bothma `signer_key` will be your key (or keys) — it doesn't get used in the flow after spawning.
// `admin_addr` will be _our_ key (or smart contract), which can only work with DDO/Did info, 
// and `owner_addr` will be the key that controls the wallet features, that belong to the user.

require('./database')(false).then(function(database) {

  var {user, crypto_key} = database.models
  
  process.on('message', function(msg) {

    if (!msg.did_allocation_request) return
    
    var {user_id} = msg.did_allocation_request
    
    crypto_key.findOne({
      where: {
        owner_id: user_id,
        alias: 'eis'
      }
    }).then(function(found) {
      if (!found) {
        return console.log(
          'fatal error: user has no eis key'
        )
      }

      // send message to eis service
      // admin_addr, owner_addr, signer_key, on_spawned
      isw.spawn(
        env.EIS_ADMIN_KEY,
        found.private_key.toString('hex'),
        env.EIS_SIGNER_KEY,
        console.log.bind(
          console,
          'EIS RESPONSE'
        )
      )

      // user.update(
      //   {did: did},
      //   {where: {id: user_id}}
      // ).then(function() {
      //   process.send({
      //     notification_request: {
      //       type: 'received_did',
      //       user_id: user_id,
      //       data: {
      //         type: 'received_did',
      //         received_did: true,
      //         did_value: did
      //       },
      //       notification: {
      //         title: 'You have been allocated a decentralised identifier',
      //         body: 'Click here to view your DID!'
      //       }
      //     }
      //   })
      // }).catch(console.log)
    }).catch(console.log)
  })
  
  process.send({ready: true})
  
})