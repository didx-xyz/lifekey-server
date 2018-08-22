
'use strict'

var env = require('./env')()
const sdk = require('indy-sdk');
var wallet = require('../sovrin/wallet')

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
      { name: 'ISA' }
    ).sort({id: 'desc'}).limit(1).exec(function(schema){
      if(!schema){
        var schema_location = 'http://schema.cnsnt.io/information_sharing_agreement'
        var schema = {
          '@context': {
            id: '@id',
            type: '@type',
            cn: 'http://schema.cnsnt.io/',
            isa: 'cn:isa',
            request: 'cn:isaRequest',
            response: 'cn:isaResponse',
            requestSignatureValue: 'cn:requestSignatureValue',
            isaSignatureValue: 'cn:isaSignatureValue',
            purpose: 'cn:isaPurpose',
            license: 'cn:isaLicense',
            entities: 'cn:isaEntities',
            optionalEntities: 'cn:entities',
            durationDays: 'cn:durationDays',
            requestedBy: 'cn:decentralisedIdentifier',
            respondedBy: 'cn:decentralisedIdentifier',
            accepted: 'cn:accepted',
            expiresAt: 'cn:expiresAt'
          }
        }


        // Schema
        req = await indy.buildSchemaRequest(myDid, schema)
        req = await indy.signRequest(wh, myDid, req)
        res = await indy.submitRequest(pool.handle, req)
      }else if(!schema.credDefId){

      } else {
        return schema.credDefId;
      }
      
    })
  }).then(function(){
    return models.user.findOne({
      where: (
        { did: isa.from_did }
      )
    })
  }).then(function (found) {
    var wh = wallet.openWalletForUser(found.id);
    var [credDefId, credDef] = await sdk.issuerCreateAndStoreCredentialDef(wh, isa.from_did, schema, 'ISA', 'CL', { support_revocation: true })
    req = await sdk.buildCredDefRequest(myDid, credDef)
    res = await sdk.signAndSubmitRequest(pool.handle, wh, myDid, req)
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