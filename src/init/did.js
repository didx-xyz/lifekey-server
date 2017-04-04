
'use strict'

var crypto = require('crypto')

var secp = require('secp256k1')
var eu = require('ethereumjs-util')

var env = require('./env')()
var isw = require('identity-service-wrapper')(env.EIS_HOST)

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
        return console.log('EIS ERROR', 'user has no eis key')
      }

      var admin_address = `0x${eu.privateToAddress(Buffer.from(env.EIS_ADMIN_KEY, 'hex')).toString('hex')}`
      var user_address = `0x${eu.privateToAddress(Buffer.from(found.private_key, 'hex')).toString('hex')}`
      
      // create the did contract
      // TODO are the correct private keys used?
      isw.spawn(admin_address, user_address, env.EIS_SIGNER_KEY, function(err, did_address) {
        if (err) {
          return console.log('EIS ERROR', err)
        }

        // generate a did value
        var did_value = crypto.rng(32).toString('hex')

        // send the did value to the did contract
        // TODO does this use the correct private key?
        isw.update(did_address, did_value, env.EIS_ADMIN_KEY, function(err, updated) {
          if (err) return console.log('EIS ERROR', err)
          // TODO ensure return type of isw#update
          
          // use the did address to check if the value
          // we just sent matches the one we generated
          isw.verify(did_address, function(err, res) {
            if (err) {
              return console.log('EIS ERROR', err)
            } else if (res === did_value) {
              
              // update user record with contract address and did value
              user.update({
                did_address: did_address,
                did: did_value
              }, {
                where: {id: user_id}
              }).then(function(updated) {
                if (!updated[0]) {
                  return console.log('EIS ERROR', 'unable to update user record')
                }
                
                // send push notification/webhook to user
                // once user record has been updated
                process.send({
                  notification_request: {
                    type: 'received_did',
                    user_id: user_id,
                    data: {
                      type: 'received_did',
                      received_did: true,
                      did_value: did_value,
                      did_address: did_address
                    },
                    notification: {
                      title: 'You have been allocated a decentralised identifier',
                      body: 'Click here to view your DID!'
                    }
                  }
                })
              }).catch(console.log)
            } else {
              // values don't match
              console.log('EIS ERROR', 'did contract update failed', res, did_value)
            }
          })
        })
      })
    }).catch(console.log)
  })
  
  process.send({ready: true})
  
})