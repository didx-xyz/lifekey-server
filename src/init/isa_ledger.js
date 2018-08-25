
'use strict'

var config = require('./env')()
const sdk = require('indy-sdk');
var sovrin = require('../sovrin')
var wallet = require('../sovrin/wallet')
var schema_attribute_names = [
  "isa", 
  "request",
  "response",
  "requestSignatureValue",
  "isaSignatureValue",
  "purpose",
  "license",
  "entities",
  "optionalEntities",
  "durationDays",
  "requestedBy",
  "respondedBy",
  "accepted",
  "expiresAt"
]
// forward references
var models = {}

require('./database')(
  false // disable logging
).then(function (database) {
  models = database.models
  process.on('message', process_message)
}).send({ ready: true })

function process_message(msg) {

  if (!msg.isa_ledger_request) return

  var { isa_id } = msg.isa_ledger_request

  models.consent_schemas.findOne({
    where: (
      { name: 'information_sharing_agreement' }
    ).sort({id: 'desc'}).limit(1).exec(function(schema){
      if(!schema){
        
        models.consent_schemas.create({
          name: 'information sharing agreement',
          uri: 'http://schema.cnsnt.io/information_sharing_agreement',
          attributes: schema_attribute_names,
          version: '1.0'

        }).then(function(schema){
          let schema_id = await sovrin.issuer.createSchema('information sharing agreement', '1.0', schema_attribute_names)
          let cred_def_id  = await sovrin.issuer.createCredDef(schema_id, 'ISA')

          return models.consent_schemas.update({
            schemaNo: schema_id,
            credDefId: cred_def_id
          }, {
          where: {id: schema.id}
        }).then(function(updated){
          return updated.credDefId
        }).catch(console.error)
      })
     } else {
        return schema.credDefId;
      }
    })
  }).then(function(credDefId){
    return models.user.findOne({
      where: (
        { did: isa.from_did }
      )
    })
  }).then(function (found) {
    let cred_def_id  = await sovrin.issuer.createCredDef(schema_id, 'ISA')
    //
    return credDefId
  }).then(function (credDefId) {
    return Promise.all([
      models.isa_receipt_transaction.create({
        isa_id: isa_id,
        transaction_hash: '0x',
        receipt_hash: '0x',
        credDefId: credDefId
      }),
      models.information_sharing_agreement.update({
        credDefId: credDefId
      }, {
          where: { id: isa_id }
        })
    ])
  }).then(function (res) {
    return models.information_sharing_agreement.findOne({
      where: { credDefId: credDefId }
    })
  }).then(function (isa) {
    if (!isa) return Promise.resolve()
    process.send({
      notification_request: {
        user_id: isa.to_did,
        notification: {
          title: 'ISA Ledgered to Blockchain',
          body: 'Your ISA has been ledgered'
        },
        data: {
          type: 'isa_ledgered',
          isa_id: isa_id,
          txid: credDefId
        }
      }
    })
    process.send({
      notification_request: {
        user_id: isa.from_did,
        notification: {
          title: 'ISA Ledgered to Blockchain',
          body: 'Your ISA has been ledgered'
        },
        data: {
          type: 'isa_ledgered',
          isa_id: isa_id,
          txid: credDefId
        }
      }
    })
    return Promise.resolve()
  }).then(function () {
    console.log('confirmed receipt ledgering for isa', isa_id)
  }).catch(console.log)
}