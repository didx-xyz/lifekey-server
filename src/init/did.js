
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
      isw.spawn(admin_address, user_address, env.EIS_SIGNER_KEY, function(err, skip, receipt_logs) {
        if (err) {
          return console.log('EIS spawn error', err)
        }
        var did_addr = '0x' + receipt_logs[0].data.slice(26).slice(0, 40)

        // generate a did value
        var did_value = crypto.rng(32).toString('hex')

        // send the did value to the did contract
        isw.update(did_addr, did_value, env.EIS_ADMIN_KEY, function(err, updated, receipt_logs) {
          if (err) return console.log('EIS update error', err)

          // use the did address to check if the value
          // we just sent matches the one we generated
          isw.verify(did_addr, function(err, res) {
            if (err) {
              return console.log('EIS verify error', err)
            } else if (res === did_value) {
              // update user record with contract address and did value
              user.update({
                did_address: did_addr,
                did: did_value
              }, {
                where: {id: user_id}
              }).then(function(updated) {
                if (!updated[0]) {
                  return console.log('EIS db update error', 'unable to update user record')
                }
                
                process.send({
                  notification_request: {
                    type: 'received_did',
                    user_id: user_id,
                    data: {
                      type: 'received_did',
                      received_did: true,
                      did_value: did_value,
                      did_address: did_addr
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
              console.log('EIS verify error', 'did contract update failed', res, did_value)
            }
          })
        })
      })
    }).catch(console.log)
  })
  
  process.send({ready: true})
  
})