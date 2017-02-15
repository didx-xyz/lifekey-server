
// TODO check server.get('did_service_ready') before posting a message to the service
// TODO add retries if did service is unavailable
// TODO resolve this data structure dynamically (over the network)

var send_is_undefined = !process.send
if (send_is_undefined) process.send = function() {}

var CNSNT_SERVER_HOSTNAME = 'pdr.cnsnt.io'
var CNSNT_SCHEMA_HOST = 'http://schema.cnsnt.io/'
var CONNECTION_REQUEST_CTX = {
  '@context': {
    id: '@id',
    type: '@type',
    cn: 'http://schema.cnsnt.io/',
    from: 'cn:from',
    to: 'cn:to',
    resolution: 'cn:resolution',
    resolverSignature: 'cn:resolverSignature',
    dateAcknowledged: 'cn:dateAcknowledged',
    dateResolved: 'cn:dateResolved'
  }
}, INFORMATION_SHARING_AGREEMENT_CTX = {
  '@context': {
    id: '@id',
    type: '@type',
    cn: 'http://schema.cnsnt.io/',
    from: 'cn:from',
    to: 'cn:to',
    resolution: 'cn:resolution',
    dateAcknowledged: 'cn:dateAcknowledged',
    dateResolved: 'cn:dateResolved',
    dateExpires: 'cn:dateExpires',
    requestedResourceUris: 'cn:requestedResourceUris',
    permittedResourceUris: 'cn:permittedResourceUris',
    purpose: 'cn:purpose',
    license: 'cn:license'
  }
}

var crypto = require('crypto')

var cuid = require('cuid')
var secp = require('eccrypto')
var ursa = require('ursa')
var sendmail = require('sendmail')({/* TODO sendmail cfg */})
var jsonld = require('jsonld')
var query = require('ld-query')

function sendActivationEmail(nickname, address, identifier) {
  if (send_is_undefined) return
  // TODO mail configuration
  sendmail({
    from: 'no-reply@consent.global',
    to: address,
    subject: 'Consent account activation',
    html: `<p>Hi ${nickname}!</p><p>Please <a href="http://${CNSNT_SERVER_HOSTNAME}/management/activation/${identifier}">click here</a> to verify your email address and activate your account.</p>`,
  }, function(err, reply) {
    // TODO handle email send retries
    if (err) return console.log('sendmail failure', err)
  })
}

module.exports = [
  
  // 0 POST /management/register
  {
    uri: '/management/register',
    method: 'post',
    secure: false,
    active: false,
    callback: function(req, res) {

      var {
        email,
        nickname,
        device_id,
        device_platform,
        public_key_algorithm,
        public_key,
        plaintext_proof,
        signable_proof,
        signed_proof
      } = req.body

      var activation_code, created_user_id, key_buffers

      // ensure all required args are present
      if (!(email &&
            nickname &&
            device_id &&
            device_platform &&
            public_key_algorithm &&
            public_key &&
            plaintext_proof &&
            signed_proof)) {
        res.status(400)
        return res.json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      var supported_algo = !!~['secp256k1', 'rsa'].indexOf(public_key_algorithm)
      if (!supported_algo) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'unsupported key algorithm',
          body: null
        })
      }

      var {
        user,
        user_device,
        crypto_key,
        http_request_verification
      } = this.get('models')
      
      // first, make sure the given sig and
      // pubkey haven't been used before
      http_request_verification.findOne({
        where: {
          public_key: public_key,
          plaintext: plaintext_proof,
          signature: signed_proof
        }
      }).then(function(found) {
        if (found) { // get outta here, guy
          return Promise.reject({
            error: true,
            status: 400,
            message: 'known signature detected',
            body: null
          })
        }
        // then make sure the user does not yet exist
        return user.findOne({where: {email: email}})
      }).then(function(found) {
        if (found) { // get outta here, guy
          return Promise.reject({
            error: true,
            status: 400,
            message: 'user already exists',
            body: null
          })
        }
        return Promise.resolve()
      }).then(function() {
        var b_public_key = Buffer.from(public_key, 'base64')
        // var b_signable_proof = Buffer.from(signable_proof, 'base64')
        var b_signable_proof = crypto.createHash('sha256').update(plaintext_proof).digest()
        var b_signed_proof = Buffer.from(signed_proof, 'base64')
        if (!(b_public_key.length && b_signable_proof.length && b_signed_proof.length)) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'base64 parsing or shasum error in any of: public_key, plaintext_proof signed_proof',
            body: null
          })
        }
        return Promise.resolve([b_public_key, b_signable_proof, b_signed_proof])
      }).then(function(keys) {
        // optimistically make them available in outer function context
        key_buffers = keys

        // and then verify ownership of given public key
        var lower_public_key_algorithm = public_key_algorithm.toLowerCase()
        if (lower_public_key_algorithm === 'secp256k1') {
          return secp.verify(...keys)
        } else if (lower_public_key_algorithm === 'rsa') {
          try {
            var rsa_public_key = ursa.coercePublicKey(keys[0].toString('utf8'))
            return (
              rsa_public_key.hashAndVerify(
                'sha256',
                Buffer(plaintext_proof),
                signed_proof,
                'base64',
                true
              )
            ) ? Promise.resolve() : (
              Promise.reject({
                error: true,
                status: 400,
                message: 'signature verification failed',
                body: null
              })
            )
          } catch (e) {
            return Promise.reject({
              error: true,
              status: 400,
              message: e.toString(),
              body: null
            })
          }
        } else {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'unsupported key algorithm',
            body: null
          })
        }
      }).then(function() {
        
        // now store the key and sig for posterity
        return http_request_verification.create({
          public_key: public_key,
          algorithm: public_key_algorithm,
          plaintext: plaintext_proof,
          signature: signed_proof
        })
      }).then(function(created) {
        if (created) {
          activation_code = cuid()
          // add the user if we stored
          // the verification successfully
          return user.create({
            email: email,
            nickname: nickname,
            app_activation_code: activation_code
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create http_request_verification record',
          body: null
        })
      }).then(function(created) {
        if (created) {
          created_user_id = created.id
          // now add the user's device so
          // we can communicate via firebase
          return user_device.create({
            owner_id: created.id,
            platform: device_platform,
            device_id: device_id
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user record',
          body: null
        })
      }).then(function(created) {
        if (created) {
          // send a task to the did service
          // to allocate a did to the new user
          
          // NOTE - we cannot guarantee message delivery
          // by returning from process#send's callback parameter
          // due to the promise pipeline we're sitting inside
          return Promise.resolve(
            process.send({
              webhook_request: {},
              did_allocation_request: {
                user_id: created_user_id,
                device_id: created.device_id
                // TODO add more message parameters
              }
            })
          )
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_device record',
          body: null
        })
      }).then(function() {
        // next, create a crypto_key record
        // for the user's given signing key
        return crypto_key.create({
          algorithm: public_key_algorithm,
          purpose: 'sign',
          alias: 'client-server-http',
          public_key: key_buffers[0],
          owner_id: created_user_id
        })
      }).then(function(created) {
        if (created) {
          return Promise.resolve(
            // send an activation email
            // concurrently to the promise pipeline
            sendActivationEmail(nickname, email, activation_code)
          )
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create crypto_key record',
          body: null
        })
      }).then(function() {
        // and finally respond affirmatively
        // to the calling agent
        return Promise.resolve(
          res.status(201).json({
            error: false,
            status: 201,
            message: 'created user record',
            body: {id: created_user_id}
            // until the user's DID has been allocated
            // this is all we can give back to the calling agent
          })
        )
      }).catch(function(err) {
        if (err.toString() === 'Error: couldn\'t parse DER signature') {
          err = {
            error: true,
            status: 400,
            message: 'non-signature value given',
            body: null
          }
        }
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 1 POST /management/device
  {
    uri: '/management/device',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user, user_device} = this.get('models')
      var {device_id, device_platform} = req.body

      if (!(device_id && device_platform)) {
        res.status(400)
        return res.json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      user_device.upsert({
        owner_id: req.user.id,
        device_id: device_id,
        platform: device_platform
      }).then(function(created) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'device_id saved',
          body: null
        })
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 2 POST /management/connection
  {
    uri: '/management/connection',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      // send a connection request
      var {document, target} = req.body
      var {user, user_device, user_connection_request} = this.get('models')
      var ucr

      var parse_json_doc = (function(document) {
        if (!(document || target)) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'missing request body parameters',
            body: null
          })
        } else if (document) {
          // jsonld takes precedence over regular ids/dids
          try {
            document = JSON.parse(document)
          } catch (e) {
            return Promise.reject({
              error: true,
              status: 400,
              message: 'expected well-formed and validatable json string',
              body: null
            })
          }
          return jsonld.promises.compact(
            document, CONNECTION_REQUEST_CTX
          ).then(function(compacted) {
            return jsonld.promises.expand(compacted)
          }).then(function(expanded) {
            var q = query(expanded, {cn: CNSNT_SCHEMA_HOST})
            target = q.query('cn:to @value')
            var vartype = typeof target
            if (vartype === 'undefined') {
              return Promise.reject({
                error: true,
                status: 400,
                message: `expected truthy type for 'to' field but got '${vartype}'`,
                body: null
              })
            }
            return Promise.resolve()
          })
        } else {
          return Promise.resolve()
        }
      })(document)

      // intersperse the OPTIONAL jsonld document
      // querying with the existing promise pipeline
      parse_json_doc.then(function() {
        if (req.user.did === target ||
            req.user.id === target) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'you cannot connect to yourself',
            body: null
          })
        }
        return user.findOne({where: {
          $or: [
            {did: target},
            {id: target}
          ]
        }})
      }).then(function(found) {
        // ensure target of ucr exists
        if (found) {
          return user_connection_request.create({
            to_id: found.id,
            from_id: req.user.id,
            to_did: found.did,
            from_did: req.user.did,
            document: req.body.document
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(created) {
        if (created) {
          // TODO webhook for programmatic user
          ucr = created
          return user_device.findOne({where: {owner_id: req.user.id}})
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_connection_request record',
          body: null
        })
      }).then(function(found) {
        if (found) {
          return Promise.resolve(
            process.send({
              webhook_request: {
                // TODO webhook url
              },
              push_notification_request: {
                device_id: found.device_id,
                // TODO notification/data envelope
              }
            })
          )
        }
      }).then(function() {
        res.status(201)
        return res.json({
          error: false,
          status: 201,
          message: 'user_connection_request record created',
          body: {id: ucr.id}
        })
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 3 GET /management/connection
  {
    uri: '/management/connection',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {

      // load models
      var {user_connection, user_connection_request} = this.get('models')

      // response body data structure
      var body = {unacked: [], enabled: []}

      // enumerate all enabled user_connections
      user_connection.findAll({
        where: {
          enabled: true,
          $and: [
            {
              $or: [
                {from_did: req.user.did},
                {to_did: req.user.did},
                {from_id: req.user.id},
                {to_id: req.user.id}
              ]
            }
          ]
        }
      }).then(function(user_connections) {
        if (user_connections) {
          // append to data structure
          body.enabled = user_connections.map(uc => uc.id)
        }
        // enumerate all unacknowledged user_connection_requests
        return user_connection_request.findAll({
          where: {
            acknowledged: null,
            $and: [
              {
                $or: [
                  {to_id: req.user.id},
                  {to_did: req.user.did}
                ]
              }
            ]
          }
        })
      }).then(function(user_connection_requests) {
        if (user_connection_requests) {
          // append to data structure
          body.unacked = user_connection_requests.map(ucr => {
            return {id: ucr.id, document: ucr.document}
          })
        }

        // respond!
        return Promise.resolve(
          res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: body
          })
        )
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 4 POST /management/connection/:user_connection_request_id
  {
    uri: '/management/connection/:user_connection_request_id',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {

      var {user_connection_request_id} = req.params
      var {accepted, document} = req.body
      var uc, ucr, requested_id // user id of target
      
      var {user, user_device, user_connection, user_connection_request} = this.get('models')

      if (typeof accepted !== 'boolean' && !document) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      var parse_json_doc = (function(document) {
        if (document) {
          try {
            document = JSON.parse(document)
          } catch (e) {
            return Promise.reject({
              error: true,
              status: 400,
              message: 'expected well-formed and validatable json string',
              body: null
            })
          }
          return jsonld.promises.compact(
            document, CONNECTION_REQUEST_CTX
          ).then(function(compacted) {
            return jsonld.promises.expand(compacted)
          }).then(function(expanded) {
            var q = query(expanded, {cn: CNSNT_SCHEMA_HOST})
            requested_id = q.query('cn:from @value')
            accepted = q.query('cn:resolution @value') || false
            var vartype = typeof requested_id
            if (vartype === 'undefined') {
              return Promise.reject({
                error: true,
                status: 400,
                message: `expected truthy type for 'from' field but got '${vartype}'`,
                body: null
              })
            }
            return Promise.resolve()
          })
        }
        return Promise.resolve()
      })(document)
      
      parse_json_doc.then(function() {
        // TODO ensure the calling agent is responding to a connection request targeted at them
        return user_connection_request.findOne({
          where: {
            id: user_connection_request_id,
            acknowledged: null,
            accepted: null,
            $and: [
              {
                $or: [
                  {to_did: req.user.did},
                  {to_id: req.user.id}
                ]
              }
            ]
          }
        })
      }).then(function(found) {
        if (found) {
          // accept/reject the ucr

          ucr = found

          return found.update({
            acknowledged: true,
            accepted: accepted
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_connection_request record not found',
          body: null
        })
      }).then(function(updated) {
        if (updated) {
          // update the associated uc record
          return user_connection.create({
            to_id: updated.to_id,
            from_id: updated.from_id,
            to_did: updated.to_did,
            from_did: updated.from_did,
            enabled: accepted
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'update failed',
          body: null
        })
      }).then(function(created) {
        if (created) {
          uc = created
          return user.findOne({
            where: {
              $or: [
                {did: created.from_did},
                {id: created.from_id}
              ]
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_connection record',
          body: null
        })
      }).then(function(found) {
        if (found) {
          return user_device.findOne({where: {owner_id: found.id}})
        }
        return res.status(404).json({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          return Promise.resolve(
            process.send({
              webhook_request: {
                // TODO webhook url
              },
              push_notification_request: {
                recipient: found.device_id,
                // TODO message args (notification/data)
              }
            })
          )
        }
        return res.status(404).json({
          error: true,
          status: 404,
          message: 'user_device record not found',
          body: null
        })
      }).then(function() {
        // node generates a warning if this res.json
        // call is NOT wrapped in a promise O_o
        return Promise.resolve(
          res.status(200).json({
            error: false,
            status: 201,
            message: 'user_connection created',
            body: {id: uc.id}
          })
        )
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 5 PUT /management/connection/:user_connection_id
  {
    uri: '/management/connection/:user_connection_id',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_connection_id} = req.params
      var {enabled} = req.body
      var old_value, other_party
      var {user, user_device, user_connection} = this.get('models')

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      user_connection.findOne({
        where: {
          id: user_connection_id,
          $and: [
            {
              $or: [
                {to_id: req.user.id},
                {from_id: req.user.id},
                {to_did: req.user.did},
                {from_did: req.user.did}
              ]
            }
          ]
        }
      }).then(function(found) {
        if (found) {
          if (found.enabled !== enabled) {
            old_value = found.enabled
            // figure out who the other party in the connection is
            // DIDs take prescedence
            other_party = ((
              req.user.did === found.to_did ||
              req.user.id === found.to_id
            ) ? (
              found.from_did || found.from_id
            ) : (
              found.to_did || found.to_id
            ))
            return found.update({enabled: enabled})
          }
          return Promise.reject({
            error: true,
            status: 400,
            message: 'no-op',
            body: null
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_connection record not found',
          body: null
        })
      }).then(function() {
        return user.findOne({where: {
          $or: [
            {did: other_party},
            {id: other_party}
          ]
        }})
      }).then(function(found) {
        if (found) {
          process.send({webhook_request: {url: found.webhook_url}})
          return user_device.findOne({where: {owner_id: found.id}})
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          // send notifications to other party
          return Promise.resolve(
            process.send({
              push_notification_request: {
                device_id: found.device_id
              }
            })
          )
        }
        // this case is permitted as the user may be programmitic
        return Promise.resolve()
      }).then(function() {
        return Promise.resolve(
          res.status(200).json({
            error: false,
            status: 200,
            message: 'user_connection record updated',
            body: null
          })
        )
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error ||true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 6 GET /management/activation/:activation_code
  {
    uri: '/management/activation/:activation_code',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {activation_code} = req.params
      var {user} = this.get('models')
      
      user.findOne({
        where: {app_activation_code: activation_code}
      }).then(function(found) {
        if (!found || found.app_activation_link_clicked) {
          return Promise.reject({
            error: true,
            status: 404,
            message: 'unknown activation code',
            body: null
          })
        }
        // update the record
        return found.update({app_activation_link_clicked: true})
      }).then(function() {
        res.set('Content-Type', 'text/html')
        res.status(200).end(`<p>LifeKey is now activated!</p><p><a href="cnsnt:main-menu">Click here</a> to begin!</p>`)
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 7 POST /management/isa
  {
    uri: '/management/isa',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {document, to} = req.body
      var {
        user,
        user_connection,
        information_sharing_agreement_request
      } = this.get('models')

      var to_user, purpose, license, original = document

      var parse_json_doc = (function() {
        if (!(document || to)) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'missing request body parameters',
            body: null
          })
        } else if (document) {
          // jsonld takes precedence over regular ids/dids
          try {
            document = JSON.parse(document)
          } catch (e) {
            return Promise.reject({
              error: true,
              status: 400,
              message: 'expected well-formed and validatable json string',
              body: null
            })
          }
          return jsonld.promises.compact(
            document, INFORMATION_SHARING_AGREEMENT_CTX
          ).then(function(compacted) {
            return jsonld.promises.expand(compacted)
          }).then(function(expanded) {
            var q = query(expanded, {cn: CNSNT_SCHEMA_HOST})
            to = q.query('cn:to @value')
            var from = q.query('cn:from @value')
            var requested_resources = q.queryAll('cn:requestedResourceUris @value')
            purpose = q.query('cn:purpose @value')
            license = q.query('cn:license @value')
            var from_vartype = typeof from
            var to_vartype = typeof to
            var purpose_vartype = typeof purpose
            var license_vartype = typeof license
            if (from_vartype === 'undefined' || !from) {
              return Promise.reject({
                error: true,
                status: 400,
                message: 'expected truthy type for from field but got undefined',
                body: null
              })
            } else if (from !== req.user.id && ('' + from) !== req.user.did) {
              return Promise.reject({
                error: true,
                status: 400,
                message: 'the from field does not match the calling agents identifier',
                body: null
              })
            } else if (to_vartype === 'undefined' || !to) {
              return Promise.reject({
                error: true,
                status: 400,
                message: 'expected truthy type for to field but got undefined',
                body: null
              })
            } else if (!(Array.isArray(requested_resources) && requested_resources.length)) {
              return Promise.reject({
                error: true,
                status: 400,
                message: 'expected lenghty arrayish type for requestedResourceUris field',
                body: null
              })
            } else if (purpose_vartype === 'undefined' || !purpose) {
              return Promise.reject({
                error: true,
                status: 400,
                message: 'expected truthy type for purpose field but got undefined',
                body: null
              })
            } else if (license_vartype === 'undefined' || !license) {
              return Promise.reject({
                error: true,
                status: 400,
                message: 'expected truthy type license to field but got undefined',
                body: null
              })
            }
            return Promise.resolve()
          })
        } else {
          return Promise.resolve()
        }
      })(document)

      parse_json_doc.then(function(found) {
        return user.findOne({
          where: {
            $or: [
              {did: to},
              {id: to}
            ]
          }
        })
      }).then(function(found) {
        if (found) {
          to_user = found
          return user_connection.findOne({
            where: {
              enabled: true,
              $and: [
                {
                  $or: [
                    {
                      to_did: req.user.did,
                      from_id: to
                    },
                    {
                      to_did: req.user.did,
                      from_did: to
                    },
                    {
                      from_did: req.user.did,
                      to_did: to
                    },
                    {
                      from_did: req.user.did,
                      to_id: to
                    },
                    {
                      to_id: req.user.id,
                      from_id: to
                    },
                    {
                      from_id: req.user.id,
                      to_id: to
                    },
                    {
                      to_id: req.user.id,
                      from_did: to
                    }
                  ]
                }
              ]
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          return information_sharing_agreement_request.create({
            from_did: req.user.did,
            from_id: req.user.id,
            to_did: to_user.did,
            to_id: to_user.id,
            document: original,
            license: license,
            purpose: purpose
          })
        }
        return Promise.reject({
          error: true,
          status: 400,
          message: 'expected an association to exist between the specified users but found none',
          body: null
        })
      }).then(function(created) {
        if (created) {
          process.send({
            // TODO webhook
            push_notification_request: {
              user_id: to_user.id,
              new_isa_request: true
            }
          })
          return res.status(201).json({
            error: false,
            status: 201,
            message: 'information_sharing_agreement_request record created',
            body: {id: created.id}
          })
        }
        // probably unreachable
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create information_sharing_agreement_request record',
          body: null
        })
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 8 POST /management/isa/:isar_id
  {
    uri: '/management/isa/:isar_id',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      // TO only
      // this is the ISA reply endpoint

      // NOTE
      // technically, this request has already been authorised
      // and authenticated because of the http signing key
      // 
      // the signature and verification of this document could
      // be made to be directly associated with the http request
      // verification

      var {isar_id} = req.params
      
      var {
        document,
        signature,
        signing_key_alias
      } = req.body

      var {
        crypto_key,
        information_sharing_permission,
        information_sharing_agreement,
        information_sharing_agreement_request
      } = this.get('models')

      var requested_resources, resolution, sk, isar, isa

      var parse_json_doc_and_verify_doc_signature = (function(document, signature, signing_key_alias) {
        if (!(document && signature && signing_key_alias)) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'missing required arguments',
            body: null
          })
        }
        return (signing_key_alias !== req.user.crypto.alias ? (
          crypto_key.findOne({
            where: {
              owner_id: req.user.id,
              alias: signing_key_alias
            }
          })
        ) : (
          Promise.resolve(req.user.crypto)
        )).then(function(found) {
          if (found) {
            sk = found
            return Promise.resolve()
          }
          return Promise.reject({
            error: true,
            status: 404,
            message: 'crypto_key record not found',
            body: null
          })
        }).then(function() {
          // jsonld takes precedence over regular ids/dids
          try {
            document = JSON.parse(document)
          } catch (e) {
            return Promise.reject({
              error: true,
              status: 400,
              message: 'expected well-formed and validatable json string',
              body: null
            })
          }
          return jsonld.promises.compact(
            document, INFORMATION_SHARING_AGREEMENT_CTX
          ).then(function(compacted) {
            return jsonld.promises.expand(compacted)
          }).then(function(expanded) {
            var q = query(expanded, {cn: CNSNT_SCHEMA_HOST})
            // ensure doc is the same as original from request
            resolution = q.query('cn:resolution @value')
            permitted_resources = q.queryAll('cn:permittedResourceUris @value')
            var resolution_vartype = typeof resolution
            
            if (resolution_vartype !== 'boolean') {
              return Promise.reject({
                error: true,
                status: 400,
                message: `expected boolean type for field resolution but got ${resolution_vartype}`,
                body: null
              })
            } else if (resolution &&
                       !(Array.isArray(permitted_resources) &&
                         permitted_resources.length)) {
              return Promise.reject({
                error: true,
                status: 400,
                message: 'expected lenghty arrayish type for permittedResourceUris field',
                body: null
              })
            }

            // TODO verify singature with specified signing key
            
            return Promise.resolve()
          })
        })
      })(document, signature, signing_key_alias)
      
      parse_json_doc_and_verify_doc_signature.then(function() {
        return information_sharing_agreement_request.findOne({
          where: {
            id: isar_id,
            acknowledged: null,
            $and: [
              {
                $or: [
                  {to_id: req.user.id},
                  {to_did: req.user.did}
                ]
              }
            ]
          }
        })
      }).then(function(found) {
        if (found) {
          isar = found
          var now = new Date
          return found.update({
            acknowledged: true,
            acknowledged_at: now,
            resolution: resolution,
            resolved_at: now,
            resolver_signature: signature
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement_request record not found',
          body: null
        })
      }).then(function(updated) {
        if (updated && resolution) {
          return information_sharing_agreement.create({
            isar_id: updated.id,
            from_id: updated.from_id,
            from_did: updated.from_did,
            from_url: updated.from_url,
            to_id: updated.to_id,
            to_did: updated.to_did,
            to_url: updated.to_url
          })
        } else if (!updated) {
          return Promise.reject({
            error: true,
            status: 500,
            message: 'unable to update information_sharing_agreement_request record',
            body: null
          })
        } else {
          return Promise.resolve()
        }
      }).then(function(created) {
        if (!resolution) {
          return Promise.resolve({rejected: true})
        } else if (created) {
          // TODO webhook to notify `from` party that the resources they requested are available
          isa = created
          return Promise.all(
            permitted_resources.map(function(uri) {
              return information_sharing_permission.create({
                isa_id: created.id,
                resource_uri: uri
              })
            })
          )
        } else {
          return Promise.reject({
            error: true,
            status: 500,
            message: 'unable to create information_sharing_agreement record',
            body: null
          })
        }
      }).then(function(created) {
        if (created.rejected) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'information_sharing_agreement_request rejected',
            body: null
          })
        } else if (created) {
          return res.status(201).json({
            error: false,
            status: 201,
            message: 'created information_sharing_agreement record',
            body: {id: isa.id}
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create information_sharing_permission records',
          body: null
        })
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 9 GET /management/isa
  {
    uri: '/management/isa',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {
        information_sharing_agreement_request,
        information_sharing_agreement
      } = this.get('models')
      
      var body = {
        unacked: [],
        enabled: [],
        disabled: []
      }
      
      return information_sharing_agreement_request.findAll({
        where: {
          acknowledged: null,
          $and: [
            {
              $or: [
                {to_id: req.user.id},
                {to_did: req.user.did}
              ]
            }
          ]
        }
      }).then(function(isars) {
        if (isars) {
          body.unacked = isars.map(isar => {
            return {id: isar.id, document: isar.document}
          })
        }
        return information_sharing_agreement.findAll({
          where: {
            $or: [
              {to_id: req.user.id},
              {to_did: req.user.did}
            ]
          }
        })
      }).then(function(isas) {
        if (isas) {
          body.enabled = isas.filter(
            isa => !isa.expired
          ).map(
            isa => isa.id
          )
          body.disabled = isas.filter(
            isa => isa.expired
          ).map(
            isa => isa.id
          )
        }
        return Promise.resolve()
      }).then(function() {
        return Promise.resolve(
          res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: body
          })
        )
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 10 GET /management/isa/:isa_id
  {
    uri: '/management/isa/:isa_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      // FROM and TO only
      // respond with isar and isa record

      var {isa_id} = req.params
      var {
        information_sharing_agreement,
        information_sharing_permission,
        information_sharing_agreement_request
      } = this.get('models')
      var isa, isar, isps

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          $or: [
            {to_id: req.user.id},
            {to_did: req.user.did},
            {from_id: req.user.id},
            {from_did: req.user.did}
          ]
        }
      }).then(function(found) {
        if (found) {
          isa = found
          return information_sharing_agreement_request.findOne({
            where: {id: found.isar_id}
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          isar = found
          return information_sharing_permission.findAll({
            where: {isa_id: isa_id}
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement_request record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          isps = found
          return Promise.resolve()
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_permission record(s) not found',
          body: null
        })
      }).then(function() {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: {
            information_sharing_agreement: isa.toJSON(),
            information_sharing_permissions: isps.map(isp => isp.toJSON()),
            information_sharing_agreement_request: isar.toJSON()
          }
        })
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 11 DELETE /management/isa/:isa_id
  {
    uri: '/management/isa/:isa_id',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // FROM and TO only
      // deactivate isa record

      // TODO check for noop
      var {isa_id} = req.params
      var {information_sharing_agreement} = this.get('models')

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          expired: false,
          $or: [
            {to_id: req.user.id},
            {to_did: req.user.did},
            {from_id: req.user.id},
            {from_did: req.user.did}
          ]
        }
      }).then(function(found) {
        if (found) return found.update({expired: true})
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement record not found',
          body: null
        })
      }).then(function(updated) {
        if (updated) {
          // TODO webhooks to notify concerned parties
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: null
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to update information_sharing_agreement record',
          body: null
        })
      }).catch(function(err) {
        return res.status(
          err.status || 500
        ).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  }
]