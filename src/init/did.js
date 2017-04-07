
'use strict'

var crypto = require('crypto')

var secp = require('secp256k1')
var eu = require('ethereumjs-util')

var env = require('./env')()
var isw = require('identity-service-wrapper')(env.EIS_HOST)

require('./database')(false).then(function(database) {

  var registrants = {}
  var {user, crypto_key} = database.models

  isw.registry.CreatedDID(function(err, event) {
    if (err) return console.log('EIS created_did event error', err)
    var {did, sender, owner, admin, ddo} = event.args
    if (!(owner in registrants)) return
    var {user_id, ddo} = registrants[owner]
    delete registrants[owner]
    user.update({
      did_address: did,
      did: ddo
    }, {
      where: {id: user_id}
    }).then(function(updated) {
      if (!updated[0]) {
        return console.log('EIS db update error', 'unable to update user record')
      }
      console.log('EIS ddo update success', user_id)
      process.send({
        notification_request: {
          type: 'received_did',
          user_id: user_id,
          data: {
            type: 'received_did',
            received_did: true,
            did_value: ddo,
            did_address: did
          },
          notification: {
            title: 'You have been allocated a decentralised identifier',
            body: 'Click here to view your DID!'
          }
        }
      })
    }).catch(console.log)
  })
  
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
        return console.log('EIS ERROR', 'user has no eis key')
      }

      var admin_address = `0x${eu.privateToAddress(Buffer.from(env.EIS_ADMIN_KEY, 'hex')).toString('hex')}`
      var user_address = `0x${eu.privateToAddress(Buffer.from(found.private_key, 'hex')).toString('hex')}`

      // generate a did value
      var did_value = crypto.rng(32).toString('hex')
      
      // create the did contract with initial ddo
      isw.spawn(admin_address, user_address, env.EIS_SIGNER_KEY, did_value, function(err, txhash) {
        if (err) {
          return console.log('EIS spawn error', err)
        }
        registrants[user_address] = {
          ddo: did_value,
          user_id: user_id
        }
      })
    }).catch(console.log)
  })
  
  process.send({ready: true})
  
})