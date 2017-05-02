
'use strict'

var env = require('./env')()
var crypto = require('../crypto')

function generate(resource, private_key) {
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

  return claim_instance
}

var db, models, private_key

require('./database')(
  false // disable logging
).then(function(database) {

  db = database.db
  models = database.models
  private_key = Buffer.from(env.EIS_ADMIN_KEY, 'hex')

  process.on('message', function(msg) {
    var {user_id, field} = msg.vc_generation_request
    var user
    if (field === 'email') {
      var schema = 'http://schema.cnsnt.io/contact_email'
    } else {
      console.log('unknown field and schema type, exiting...')
      return
    }
    
    models.user.findOne({
      where: {
        $or: [
          {did: user_id},
          {id: user_id}
        ]
      }
    }).then(function(found) {
      if (found) {
        user = found
        // FIXME we've run the same query twice (activation route) before we decide to skip this task
        if (found.webhook_url || found.actions_url) {
          return Promise.reject(
            new Error(
              'skipping verifiable claim generation for programmatic user ' +
              user_id
            )
          )
        }
        if (!found[field]) {
          return Promise.reject(
            new Error([
              'user',
              user_id,
              'has no',
              field
            ].join(' '))
          )
        }
        return Promise.resolve(
          generate({
            context: schema,
            is_credential: true,
            issued_for: user_id,
            created_at: new Date,
            additional_fields: {
              email: found[field]
            }
          })
        )
      }
      return Promise.reject(
        new Error(
          'unable to find user by given identifier ' +
          user_id
        )
      )
    }).then(function(instance) {
      return Promise.all([
        instance,
        crypto.asymmetric.sign(
          'secp256k1',
          private_key,
          JSON.stringify(instance.claim)
        )
      ])
    }).then(function(res) {
      res[0].signatureValue = res[1].toString('base64')
      return Promise.resolve(res[0])
    }).then(function(claim) {
      return models.user_datum.create({
        owner_id: user.id,
        entity: 'verifiable-claim',
        attribute: 'email',
        alias: 'from-lifekey-server',
        value: JSON.stringify(claim),
        encoding: 'utf8',
        mime: 'application/ld+json',
        is_verifiable_claim: true,
        schema: schema
      })
    }).then(function(created) {
      if (!created) {
        return Promise.reject(
          new Error(
            'unable to create resource record for user id ' +
            user_id
          )
        )
      }
      process.send({
        notification_request: {
          user_id: user_id,
          notification: {
            title: 'New resource received',
            body: 'You were pushed one or more resources'
          },
          data: {
            type: 'resource_pushed',
            isa_id: null,
            resource_ids: [created.id]
          }
        }
      })
    }).catch(console.log)
  }).send({ready: true})
}).catch(console.log)