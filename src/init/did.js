
'use strict'

var crypto = require('crypto')

var eu = require('ethereumjs-util')

var env = require('./env')()

var EIS_ADMIN_ADDRESS = `0x${eu.privateToAddress(Buffer.from(env.EIS_ADMIN_KEY, 'hex')).toString('hex')}`

var registrants = {}
var process_message_backlog = []
var created_did_backlog = []

// forward references to db and eth
var isw, user, crypto_key, user_datum

function process_message(msg) {
  if (!msg.did_allocation_request) return

  if (!(crypto_key || user || user_datum)) {
    process_message_backlog.push(msg)
    return
  }

  var {user_id} = msg.did_allocation_request

  crypto_key.findOne({
    where: {
      owner_id: user_id,
      alias: 'eis'
    }
  }).then(function(found) {
    if (!found) {
      return console.log(
        'did --- EIS ERROR',
        'user has no eis key',
        'perhaps this user no longer exists?'
      )
    }

    var user_address = `0x${eu.privateToAddress(Buffer.from(found.private_key, 'hex')).toString('hex')}`

    // generate a did value
    var did_value = crypto.rng(32).toString('hex')

    // create the did contract with initial ddo
    isw.spawn(
      EIS_ADMIN_ADDRESS,
      user_address,
      env.EIS_SIGNER_KEY,
      function(err, txhash) {
        if (err) {
          return console.log('did --- EIS spawn error', err)
        }
        registrants[user_address] = user_id
      }
    )

  }).catch(console.log)
}

function created_did(err, event) {
  if (err) {
    return console.log('did --- EIS created_did event error', err)
  }
  if (!(crypto_key && user && user_datum)) {
    created_did_backlog.push(event)
    return
  }
  var {did, sender, owner, admin, ddo} = event.args

  // is this significant?
  if (!(owner in registrants)) return

  var did_with_urn = `did:cnsnt:${did}`
  var user_id = registrants[owner]

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

    delete registrants[owner]

    console.log('EIS ddo updated for user', user_id)
    console.log('EIS pending registrations', Object.keys(registrants).length, registrants)
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
  }).catch(console.log.bind(console, 'did --- EIS db update error'))
}

isw = require('identity-service-wrapper')(env.EIS_HOST, env.EIS_CONTRACT_ADDRESS, env.EIS_GAS_LIMIT, env.EIS_GAS_PRICE)

isw.registry.events.CreatedDID(created_did)

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
