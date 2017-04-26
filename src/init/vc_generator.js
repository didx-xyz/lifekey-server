
'use strict'

var env = require('./env')()
var crypto = require('../crypto')

function generate(resource, private_key) {
  // resource.context array (one or more urls pointing to jsonld definitions)
  // resource.is_credential boolean (will this verfiable claim be shown as a badge in the app?)
  // resource.issued_for mixed (user id or did for whom this claim is issued)
  // resource.creator mixed (you)
  // resource.additional_fields object (gets included in the "claim" object such that each field is merged directly - each additional field must map to a field in your jsonld definition (which is referenced in the @context array))
  if (!(typeof resource === 'object' &&
        resource !== null &&
        resource.context &&
        resource.is_credential &&
        resource.issued_for &&
        resource.created_at &&
        resource.additional_fields)) {
    return Promise.reject(
      new Error(
        'missing any of the following claim parameters: ' +
        'context, issued_for, creator, created_at, ' +
        'additional_fields'
      )
    )
  }

  var claim_instance = {
    '@context': [
      'http://schema.cnsnt.io/verifiable_claim'
    ].concat(resource.context),
    claim: {
      isCredential: resource.is_credential,
      issuedFor: resource.issued_for,
      creator: 'lifekey-server',
      createdAt: resource.created_at
    },
    signatureValue: ''
  }

  Object.keys(
    resource.additional_fields
  ).forEach(function(field) {
    claim_instance.claim[field] = resource.additional_fields[field]
  })

  return crypto.asymmetric.sign(
    'secp256k1',
    private_key,
    JSON.stringify(claim_instance.claim)
  ).then(function(signature) {
    claim_instance.signatureValue = signature.toString('base64')
    return Promise.resolve(claim_instance)
  })
}

var db, models, private_key

require('./database')(
  false // disable logging
).then(function(database) {

  db = database.db
  models = database.models
  private_key = Buffer.from(env.EIS_ADMIN_KEY, 'hex')


  process.on('message', function(msg) {
    // vc_generation_request
    var {user_id, field} = msg.vc_generation_request

    models.user.findOne({
      where: {
        $or: [
          {did: user_id},
          {id: user_id}
        ]
      }
    }).then(function(found) {
      if (found) {
        if (!found[field]) {
          return Promise.reject(new Error('user ' + user_id + ' has no ' + field))
        }
        return generate({
          context: ['http://schema.cnsnt.io/' + field],
          is_credential: true,
          issued_for: user_id,
          created_at: new Date(),
          additional_fields: {
            email: found[field]
          },
        }, private_key)
      }
      return Promise.reject(new Error('unable to find user by given identifier ' + user_id))
    }).catch(console.log)

    // callback
    process.send({
      notification_request: {
        user_id: user_id,
        notification: {title: '', body: ''},
        data: {
          type: 'resource_pushed',
          isa_id: null,
          resource_ids: [new_resource_id]
        }
      }
    })
  })
}).catch(console.log)