
'use strict'

var env = require('./env')()
const sdk = require('indy-sdk');

var wallet = require('../sovrin/wallet')

// forward references to db and eth
var user, user_datum

function process_message(msg) {
  if (!msg.did_allocation_request) return

  var {user_id} = msg.did_allocation_request
  
  var user_wallet = wallet.setupNewWalletForUser(user_id)
  var [endpointDid, publicVerkey]  = await sdk.createAndStoreMyDid(user_wallet, {});
  var did_with_urn = `did:cnsnt:${endpointDid}`
  
  user.update({
    did_address: endpointDid,
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
    console.log('DID updated for user', user_id)
    process.send({
      notification_request: {
        type: 'received_did',
        user_id: user_id,
        data: {
          type: 'received_did',
          received_did: true,
          did_value: did_with_urn,
          did_address: endpointDid
        },
        notification: {
          title: 'You have been allocated a decentralised identifier',
          body: 'Click here to view your DID!'
        }
      }
    })
  }).catch(console.log.bind(console, 'did --- db update error'))
}

process.on('message', process_message)
process.send({ready: true})