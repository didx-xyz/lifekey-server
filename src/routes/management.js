
'use strict'

// TODO check server.get('did_service_ready') before posting a message to the service
// TODO add retries if did service is unavailable
// TODO some of the procedures (like registration) are not atomic - if they fail at any point, the state of the database might be partially corrupt
// TODO recovery endpoint using same params as registration, send firebase event containing public key parameters so it can be matched up on client side

var send_is_undefined = !process.send
if (send_is_undefined) process.send = function() {}

var url = require('url')
var crypto = require('crypto')

var qr = require('qr-image')
var cuid = require('cuid')

var our_crypto = require('../crypto')

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
        webhook_url,
        public_key_algorithm,
        public_key,
        plaintext_proof,
        signed_proof,
        fingerprint
      } = req.body
      
      if (!~this.get('env')._.indexOf('istanbul')) {
        console.log(req.body)
      }
      
      var using_fingerprint = false
      var is_programmatic_user, activation_code,
          created_user_id, key_buffers
      
      // ensure all required args are present
      if (!(email &&
            nickname &&
            public_key_algorithm &&
            public_key &&
            plaintext_proof &&
            signed_proof)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      // ensure all required args are present
      if (!(webhook_url || (device_id && device_platform))) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      if (webhook_url) {
        var caught = false
        try {
          var userhook = url.parse(webhook_url)
        } catch (e) {
          caught = true
        } finally {
          if (caught || !userhook.host) {
            return res.status(400).json({
              error: true,
              status: 400,
              message: (
                caught ?
                'expected string type for webhook_url' :
                'url not given for webhook_url'
              ),
              body: null
            })
          } else {
            is_programmatic_user = true
          }
        }
      }
      
      if (!our_crypto.asymmetric.is_supported_algorithm(public_key_algorithm)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'unsupported key algorithm',
          body: null
        })
      }

      // FIXME this'll throw if string not given
      var lower_algo = public_key_algorithm.toLowerCase()
      
      if (typeof fingerprint === 'object' && fingerprint !== null) {
        if (!(fingerprint.public_key_algorithm && fingerprint.public_key &&
              fingerprint.plaintext_proof && fingerprint.signed_proof)) {
          return res.status(400).json({
            error: true,
            status: 400,
            message: 'missing required fingerprint arguments',
            body: null
          })
        }
        using_fingerprint = true
      }

      var {
        user,
        user_device,
        crypto_key,
        http_request_verification
      } = this.get('models')

      var errors = this.get('db_errors')
      
      // first, make sure the given sig and
      // pubkey haven't been used before
      http_request_verification.findOne({
        where: {
          algorithm: lower_algo,
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
        return our_crypto.asymmetric.get_buffers(
          lower_algo,
          public_key,
          plaintext_proof,
          signed_proof
        )
      }).then(function(verify_parameters) {
        key_buffers = verify_parameters
        return our_crypto.asymmetric.verify(
          lower_algo,
          public_key,
          plaintext_proof,
          signed_proof
        )
      }).then(function() {
        // now store the key and sig for posterity
        return http_request_verification.create({
          public_key: public_key,
          algorithm: public_key_algorithm,
          plaintext: plaintext_proof,
          signature: signed_proof
        })
      }).then(function(created) {
        if (!created) {
          return Promise.reject({
            error: true,
            status: 500,
            message: 'unable to create http_request_verification record',
            body: null
          })
        }
        return Promise.resolve()
      }).then(function() {
        if (using_fingerprint) {
          return Promise.all([
            our_crypto.asymmetric.verify('rsa', fingerprint.public_key, fingerprint.plaintext_proof, fingerprint.signed_proof),
            (function() {
              return http_request_verification.findOne({
                where: {
                  public_key: fingerprint.public_key,
                  algorithm: fingerprint.public_key_algorithm,
                  plaintext: fingerprint.plaintext_proof,
                  signature: fingerprint.signed_proof
                }
              }).then(function(found) {
                if (found) {
                  return Promise.reject({
                    error: true,
                    status: 400,
                    message: 'detected known signature',
                    body: null
                  })
                }
                return http_request_verification.create({
                  public_key: fingerprint.public_key,
                  algorithm: fingerprint.public_key_algorithm,
                  plaintext: fingerprint.plaintext_proof,
                  signature: fingerprint.signed_proof
                })
              })
            })()
          ])
        }
        return Promise.resolve()
      }).then(function() {
        activation_code = cuid()
        // add the user if we stored
        // the verification successfully
        return user.create({
          email: email,
          nickname: nickname,
          webhook_url: webhook_url,
          app_activation_code: activation_code
        })
      }).then(function(created) {
        if (created) {
          created_user_id = created.id
          // now add the user's device so
          // we can communicate via firebase
          return is_programmatic_user ? (
            Promise.resolve(true)
          ) : user_device.create({
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
          return is_programmatic_user ? (
            Promise.resolve()
          ) : Promise.resolve(
            process.send({
              notification_request: {
                user_id: created_user_id,
                notification: {
                  title: 'Your registration with LifeKey is nearly complete!',
                  body: 'Check your email to conclude registration...'
                },
                data: {type: 'sent_activation_email'}
              },
              did_allocation_request: {
                user_id: created_user_id
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
        return Promise.all([
          crypto_key.create({
            owner_id: created_user_id,
            algorithm: 'secp256k1',
            purpose: 'sign,verify',
            alias: 'eis',
            private_key: crypto.rng(32)
          }),
          crypto_key.create({
            owner_id: created_user_id,
            algorithm: lower_algo,
            purpose: 'sign',
            alias: 'client-server-http',
            public_key: key_buffers[0]
          }),
          using_fingerprint ? crypto_key.create({
            owner_id: created_user_id,
            algorithm: 'rsa',
            purpose: 'sign',
            alias: 'fingerprint',
            public_key: Buffer.from(fingerprint.public_key, 'utf8')
          }) : null
        ])
      }).then(function() {
        return Promise.resolve(
          // send an activation email
          process.send({
            // TODO this kinda stuff needs to be wrapped up and i18n'ed
            send_email_request: {
              to: email,
              subject: 'LifeKey Account Activation',
              content: `<p>Hi ${nickname}!</p><p>Please <a href="http://${this.get('env').SERVER_HOSTNAME}/management/activation/${activation_code}">click here</a> to verify your email address and activate your account.</p>`,
              mime: 'text/html'
            }
          })
        )
      }.bind(this)).then(function() {
        // and finally respond affirmatively
        // to the calling agent
        return Promise.resolve(
          res.status(201).json({
            error: false,
            status: 201,
            message: 'created user record',
            body: {
              id: created_user_id,
              activation: (is_programmatic_user ? (
                'http://' +
                this.get('env').SERVER_HOSTNAME +
                '/management/activation/' +
                activation_code
              ) : null)
            }
          })
        )
      }.bind(this)).catch(function(err) {
        err = errors(err)
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
      var {webhook_url, device_id, device_platform} = req.body
      var errors = this.get('db_errors')

      function dispatch() {
        if (webhook_url) {
          return user.update({
            webhook_url: webhook_url
          }, {
            where: {id: req.user.id}
          })
        } else if (device_id && device_platform) {
          return user_device.update({
            device_id: device_id,
            platform: device_platform
          }, {
            where: {owner_id: req.user.id}
          })
        } else {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'missing request body parameters',
            body: null
          })
        }
      }

      dispatch().then(function(updated) {
        if (updated) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'updated',
            body: null
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to update record',
          body: null
        })
      }).catch(function(err) {
        err = errors(err)
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
      var {target} = req.body
      var {user, user_device, user_connection, user_connection_request} = this.get('models')
      var ucr, target_user

      if (!target) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      if (req.user.did === target || req.user.id === target) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'you cannot connect to yourself',
          body: null
        })
      }
      
      // find any existing user_connection
      // TODO fix this query
      user_connection.findOne({
        where: {
          enabled: true,
          $and: [
            {
              $or: [
                {to_id: req.user.id},
                {to_did: req.user.did},
                {from_id: req.user.id},
                {from_did: req.user.did},
                {to_id: target},
                {to_did: target},
                {from_id: target},
                {from_did: target}
              ]
            }
          ]
        }
      }).then(function(found) {
        if (found) {
          // cannot send connection request
          // if a connection already exists
          return Promise.reject({
            error: true,
            status: 400,
            message: 'user_connection record already exists',
            body: found.toJSON()
          })
        }
        
        // find any existing unresponded-to connection request
        // TODO fix this query
        return user_connection_request.findOne({
          where: {
            acknowledged: null,
            $and: [
              {
                $or: [
                  {to_id: req.user.id},
                  {to_did: req.user.did},
                  {from_id: req.user.id},
                  {from_did: req.user.did},
                  {to_id: target},
                  {to_did: target},
                  {from_id: target},
                  {from_did: target}
                ]
              }
            ]
          }
        })
      }).then(function(found) {
        if (found) {
          // cannot send connection request
          // if a connection request already exists
          return Promise.reject({
            error: true,
            status: 400,
            message: 'user_connection_request record already exists',
            body: found.toJSON()
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
          target_user = found
          return user_connection_request.create({
            to_id: found.id,
            from_id: req.user.id,
            to_did: found.did,
            from_did: req.user.did
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
          ucr = created
          process.send({
            notification_request: {
              user_id: created.to_id,
              notification: {
                title: 'New Connection Request',
                body: `You have received a connection request from ${req.user.nickname}!`
              },
              data: {
                type: 'user_connection_request',
                is_user_connection_request: true,
                user_connection_request_id: created.id,
                ucr_id: created.id,
                from_id: req.user.id,
                from_did: req.user.did,
                from_nickname: req.user.nickname
              }
            }
          })
          return res.status(201).json({
            error: false,
            status: 201,
            message: 'user_connection_request record created',
            body: {id: ucr.id}
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_connection_request record',
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
      var {accepted} = req.body
      var uc, ucr, requested_id // user id of target

      var {
        user,
        user_device,
        user_connection,
        user_connection_request
      } = this.get('models')

      if (typeof accepted !== 'boolean') {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      user_connection_request.findOne({
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
          var pnr_notif = {
            title: 'User Connection',
            body: 'User connection successfully created!'
          }, pnr_data = {
            type: 'user_connection_created',
            is_user_connection_created: true,
            user_connection_id: created.id,
            uc_id: created.id,
            to_id: ucr.to_id,
            from_id: ucr.from_id
          }
          process.send({
            notification_request: {
              user_id: ucr.from_id,
              notification: pnr_notif,
              data: pnr_data
            }
          })
          return Promise.resolve()
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_connection record',
          body: null
        })
      }).then(function() {
        // node generates a warning if this res.json
        // call is NOT wrapped in a promise O_o
        return Promise.resolve(
          res.status(201).json({
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

  // 5 DELETE /management/connection/:user_connection_id
  {
    uri: '/management/connection/:user_connection_id',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_connection_id} = req.params
      var {user, user_connection} = this.get('models')
      var uc
      
      // TODO ensure this only ever destroys one record
      user_connection.findOne({
        where: {
          id: user_connection_id,
          $and: [
            {
              $or: [
                {to_id: req.user.id},
                {from_id: req.user.id}
              ]
            }
          ]
        }
      }).then(function(found) {
        if (found) {
          uc = found
          return user_connection.destroy({
            where: {id: user_connection_id}
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_connection record not found',
          body: null
        })
      }).then(function(destroyed) {
        if (destroyed) {
          return user.findOne(
            {where: {id: uc.from_id}}
          )
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_connection record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          process.send({
            notification_request: {
              user_id: found.id,
              notification: {
                title: 'User Connection Deleted',
                body: 'Your connection has been deleted'
              },
              data: {
                type: 'user_connection_deleted',
                user_connection_id: uc.id,
                uc_id: uc.id
              }
            }
          })
          return Promise.resolve()
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
      }).then(function() {
        return Promise.resolve(
          res.status(200).json({
            error: false,
            status: 200,
            message: 'user_connection record deleted',
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
      var user_id
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
        user_id = found.id
        // update the record
        return found.update({app_activation_link_clicked: true})
      }).then(function() {
        process.send({
          notification_request: {
            user_id: user_id,
            notification: {
              title: 'LifeKey is now activated!',
              body: 'Thank you for activating!'
            },
            data: {
              type: 'app_activation_link_clicked'
            }
          }
        })
        res.set('Content-Type', 'text/html')
        res.status(200).end(
          '<p>LifeKey is now activated!</p>' +
          '<p><a href="lifekey:main-menu">Click here</a> to begin!</p>'
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

  // 7 POST /management/isa/request
  {
    uri: '/management/isa',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {

      var {
        to,
        optional_schemas,
        requested_schemas,
        purpose,
        license
      } = req.body

      if (!(to && purpose && license)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }
      
      if (!(Array.isArray(requested_schemas) && requested_schemas.length)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'expected lengthy arrayish type for requested_schemas field',
          body: null
        })
      }

      // requested_schemas
      // [
      //   {schema: 'Person', description: '...'},
      //   {schema: 'PostalAddress', description: 'work'}
      // ]

      var {
        user,
        user_connection,
        information_sharing_agreement_request
      } = this.get('models')

      var to_user

      user.findOne({
        where: {
          $or: [
            {did: to},
            {id: to}
          ]
        }
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
                      to_id: req.user.id,
                      from_id: to
                    },
                    {
                      from_id: req.user.id,
                      to_id: to
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
            license: license,
            optional_schemas: JSON.stringify(optional_schemas),
            requested_schemas: JSON.stringify(requested_schemas),
            purpose: purpose
          })
        }
        return Promise.reject({
          error: true,
          status: 400,
          message: 'user_connection record not found',
          body: null
        })
      }).then(function(created) {
        if (created) {
          process.send({
            notification_request: {
              user_id: to_user.id,
              notification: {
                title: 'New Information Sharing Agreement',
                body: 'New information sharing agreement'
              },
              data: {
                type: 'information_sharing_agreement_request',
                from_id: req.user.id,
                isar_id: created.id
              }
            }
          })
          return Promise.resolve(
            res.status(201).json({
              error: false,
              status: 201,
              message: 'information_sharing_agreement_request record created',
              body: {id: created.id}
            })
          )
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

  // 8 POST /management/isa/respond/:isar_id
  {
    uri: '/management/isa/:isar_id',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      // TO only
      // this is the ISA reply endpoint

      var {isar_id} = req.params
      var {accepted, permitted_resources} = req.body
      
      if (typeof accepted !== 'boolean') {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'expected boolean type for accepted field',
          body: null
        })
      }

      if (accepted && !(Array.isArray(permitted_resources) &&
          permitted_resources.length)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'expected lengthy arrayish type for permitted_resources field',
          body: null
        })
      }

      var {
        information_sharing_permission,
        information_sharing_agreement,
        information_sharing_agreement_request
      } = this.get('models')

      var isar, isa, from_id

      information_sharing_agreement_request.findOne({
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
      }).then(function(found) {
        if (found) {
          isar = found
          from_id = found.from_id
          var now = new Date
          return found.update({
            acknowledged: true,
            acknowledged_at: now,
            accepted: accepted,
            resolved_at: now
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement_request record not found',
          body: null
        })
      }).then(function(updated) {
        if (!updated) {
          return Promise.reject({
            error: true,
            status: 500,
            message: 'unable to update information_sharing_agreement_request record',
            body: null
          })
        } else if (!accepted) {
          process.send({
            notification_request: {
              user_id: from_id,
              notification: {
                title: 'Information Sharing Agreement Request Rejected',
                body: 'Your ISA request was rejected'
              },
              data: {
                type: 'information_sharing_agreement_request_rejected',
                isar_id: isar_id
              }
            }
          })
          return Promise.reject({
            error: false,
            status: 200,
            message: 'information_sharing_agreement_request rejected',
            body: null
          })
        } else {
          return information_sharing_agreement.create({
            isar_id: updated.id,
            from_id: updated.from_id,
            from_did: updated.from_did,
            to_id: updated.to_id,
            to_did: updated.to_did
          })
        }
      }).then(function(created) {
        if (created) {
          process.send({
            notification_request: {
              user_id: from_id,
              notification: {
                title: 'Information Sharing Agreement Request Accepted',
                body: 'Your ISA request was accepted'
              },
              data: {
                type: 'information_sharing_agreement_request_accepted',
                isa_id: created.id
              }
            }
          })
          isa = created
          return Promise.all(
            permitted_resources.map(function(resource) {
              return information_sharing_permission.create({
                isa_id: created.id,
                user_datum_id: resource.id
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
        if (created) {
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
          error: typeof err.error === 'boolean' ? err.error : true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },

  // 9 GET /management/isa/get
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
      
      information_sharing_agreement_request.findAll({
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
            return {
              id: isar.id,
              requested_schemas: JSON.parse(isar.requested_schemas)
            }
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
          body.enabled = isas.filter(isa => !isa.expired).map(isa => isa.id)
          body.disabled = isas.filter(isa => isa.expired).map(isa => isa.id)
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

  // 10 GET /management/isa/get/:isa_id
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

  // 11 DELETE /management/isa/delete/:isa_id
  {
    uri: '/management/isa/:isa_id',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // FROM and TO only
      // deactivate isa record

      var {isa_id} = req.params
      var {information_sharing_agreement} = this.get('models')

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          expired: false,
          $and: [
            {
              $or: [
                {to_id: req.user.id},
                {from_id: req.user.id}
              ]
            }
          ]
        }
      }).then(function(found) {
        if (found) {
          process.send({
            notification_request: {
              user_id: found.to_id,
              notification: {
                title: 'Information Sharing Agreement Deleted',
                body: 'Your ISA has been deleted'
              },
              data: {
                type: 'information_sharing_agreement_deleted',
                isa_id: found.id
              }
            }
          })
          process.send({
            notification_request: {
              user_id: found.from_id,
              notification: {
                title: 'Information Sharing Agreement Deleted',
                body: 'Your ISA has been deleted'
              },
              data: {
                type: 'information_sharing_agreement_deleted',
                isa_id: found.id
              }
            }
          })
          return found.update({expired: true})
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement record not found',
          body: null
        })
      }).then(function(updated) {
        if (updated) {
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
  },

  // 12 GET /qr/:user_id
  {
    uri: '/qr/:user_id',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {user_id} = req.params
      var {user} = this.get('models')
      user.findOne({
        where: {
          $or: [
            {id: user_id},
            {did: user_id}
          ]
        }
      }).then(function(found) {
        if (found) {
          var {SERVER_HOSTNAME} = this.get('env')
          return qr.image(
            `${SERVER_HOSTNAME}/profile/${found.id}`,
            {type: 'png'}
          ).pipe(res)
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
      }.bind(this)).catch(function(err) {
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

  // 13 PUT /management/isa/update/:isa_id
  {
    uri: '/management/isa/:isa_id',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {isa_id} = req.params
      var {permitted_resources} = req.body

      // permitted_resources
      // [
      //    {id: 5},
      //    ...
      // ]
      if (!(Array.isArray(permitted_resources) && permitted_resources.length)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'expected lengthy arrayish type for permitted_resources field',
          body: null
        })
      }

      var {
        information_sharing_agreement,
        information_sharing_agreement_request,
        information_sharing_permission
      } = this.get('models')

      var from_user

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          $and: [
            {
              $or: [
                {from_id: req.user.id},
                {to_id: req.user.id}
              ]
            }
          ]
        }
      }).then(function(found) {
        if (found && (
          found.to_id === req.user.id ||
          found.to_did === req.user.did
        )) {
          from_user = found.from_id
          return Promise.resolve(found)
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement record not found',
          body: null
        })
      }).then(function(found) {
        if (!found.expired) {
          return information_sharing_permission.destroy({
            where: {isa_id: isa_id}
          })
        }
        return Promise.reject({
          error: true,
          status: 400,
          message: 'information_sharing_agreement record has expired',
          body: null
        })
      }).then(function() {
        return Promise.all(
          permitted_resources.map(function(resource) {
            return information_sharing_permission.create({
              isa_id: isa_id,
              user_datum_id: resource.id
            })
          })
        )
      }).then(function(created) {
        process.send({
          notification_request: {
            user_id: from_user,
            notification: {
              title: 'Information Sharing Agreement Updated',
              body: 'Click here to see any changes to the ISA'
            },
            data: {
              type: 'information_sharing_agreement_updated',
              isa_id: isa_id
            }
          }
        })
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'information_sharing_permission records updated',
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

  // 14 GET /management/isa/pull/:isa_id
  {
    uri: '/management/pull/:isa_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {isa_id} = req.params
      var {
        information_sharing_agreement,
        information_sharing_permission,
        user_datum
      } = this.get('models')

      var to_user, body = {}

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          from_id: req.user.id
        }
      }).then(function(found) {
        if (found) {
          to_user = found.to_id
          return Promise.resolve(found)
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement record not found',
          body: null
        })
      }).then(function(found) {
        if (!found.expired) {
          return information_sharing_permission.findAll({
            where: {isa_id: isa_id}
          })
        }
        return Promise.reject({
          error: true,
          status: 400,
          message: 'information_sharing_agreement record has expired',
          body: null
        })
      }).then(function(found) {
        if (found && found.length) {
          return Promise.all(
            found.map(function(isp) {
              return user_datum.findOne({
                where: {
                  owner_id: to_user,
                  id: isp.user_datum_id
                }
              })
            })
          )
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_permission records not found',
          body: null
        })
      }).then(function(found) {
        if (found && found.length) {
          body.user_data = found.map(function(ud) {
            return ud.toJSON()
          })
          return Promise.resolve()
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_datum records not found',
          body: null
        })
      }).then(function() {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: body
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

  // 15 POST /management/isa/push/:isa_id
  {
    uri: '/management/push/:isa_id',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {isa_id} = req.params
      var {resources} = req.body
      var other_user_id
      
      if (!(Array.isArray(resources) && resources.length)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      var {
        information_sharing_agreement,
        user_datum
      } = this.get('models')
      
      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          from_id: req.user.id
        }
      }).then(function(found) {
        if (found) {
          if (found.expired) {
            return Promise.reject({
              error: true,
              status: 403,
              message: 'information_sharing_agreement expired',
              body: null
            })
          }
          other_user_id = (
            req.user.id === found.to_id ?
            found.from_id :
            found.to_id
          )
          return Promise.all(
            resources.map(function(resource, idx) {
              return user_datum.create({
                owner_id: other_user_id,
                entity: req.user.id,
                attribute: resource.name,
                alias: idx + 1,
                mime: resource.mime,
                value: resource.value,
                uri: resource.uri,
                from_user_id: req.user.id,
                from_resource_name: resource.name,
                from_resource_description: resource.description,
                is_verifiable_claim: resource.is_verifiable_claim,
                encoding: resource.encoding,
                schema: resource.schema
              })
            })
          )
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement record not found',
          body: null
        })
      }).then(function(created) {
        if (created) {
          process.send({
            notification_request: {
              user_id: other_user_id,
              notification: {
                title: 'ISA Resources Pushed',
                body: 'One or more resources were pushed to you'
              },
              data: {
                type: 'resource_pushed',
                isa_id: isa_id,
                resource_ids: created.map(function(c) {
                  return c.id
                })
              }
            }
          })
          return res.status(201).json({
            error: false,
            status: 201,
            message: 'created',
            body: null
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'internal server error',
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

  // 16 GET /management/thanks/balance
  {
    uri: '/management/thanks/balance',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      return res.status(200).json({
        error: false,
        status: 200,
        message: 'ok',
        body: {balance: 0} // we can only pretend for now
      })
    }
  },

  // 17 POST /management/key
  {
    uri: '/management/key',
    method: 'post',
    secure: true,
    active: false,
    callback: function(req, res) {

      var {
        plaintext_proof,
        signed_proof,
        public_key,
        public_key_algorithm,
        alias,
        purpose
      } = req.body

      if (!(plaintext_proof &&
            signed_proof &&
            public_key &&
            public_key_algorithm &&
            alias &&
            purpose)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      var {
        crypto_key,
        http_request_verification
      } = this.get('models')
      var errors = this.get('db_errors')

      if (!our_crypto.asymmetric.is_supported_algorithm(public_key_algorithm)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'unsupported key algorithm',
          body: null
        })
      }

      var lower_algo = public_key_algorithm.toLowerCase()
      var key_buffers

      http_request_verification.findOne({
        where: {
          algorithm: lower_algo,
          signature: signed_proof
        }
      }).then(function(found) {
        if (found) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'detected known signature',
            body: null
          })
        }
        return crypto_key.findOne({
          where: {
            owner_id: req.user.id,
            alias: alias
          }
        })
      }).then(function(found) {
        if (found) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'duplicate key alias',
            body: null
          })
        }
        return our_crypto.asymmetric.get_buffers(lower_algo, public_key, plaintext_proof, signed_proof)
      }).then(function(keys) {
        key_buffers = keys
        return our_crypto.asymmetric.verify(lower_algo, public_key, plaintext_proof, signed_proof)
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
          return crypto_key.create({
            algorithm: public_key_algorithm,
            purpose: purpose || 'sign',
            alias: alias,
            public_key: key_buffers[0],
            owner_id: req.user.id
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
          return res.status(201).json({
            error: false,
            status: 201,
            message: 'crypto_key record created',
            body: null
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create crypto_key record',
          body: null
        })
      }).catch(function(err) {
        err = errors(err)
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

  // 18 GET /management/key/:id?alias
  {
    uri: '/management/key/:user_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_id} = req.params
      var {alias} = req.query
      var {crypto_key} = this.get('models')
      var query = {
        owner_id: user_id,
        alias: 'client-server-http'
      }
      if (alias) query.alias = alias
      crypto_key.findOne({
        where: query
      }).then(function(found) {
        if (found) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: {
              public_key_algorithm: found.algorithm,
              public_key: found.public_key.toString(
                found.algorithm === 'rsa' ?
                'utf8' :
                'base64'
              )
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'crypto_key record not found',
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

  // 19 POST /management/action
  {
    uri: '/management/action',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {
        purpose, license, entities,
        optional_entities, duration_days
      } = req.body

      var has_optional = false

      if (!(purpose &&
            license &&
            Array.isArray(entities) &&
            entities.length &&
            duration_days)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      if (Array.isArray(optional_entities) && optional_entities.length) {
        has_optional = true
      }

      var errors = this.get('db_errors')
      var {user_action} = this.get('models')
      
      user_action.create({
        owner_id: req.user.id,
        purpose: purpose,
        license: license,
        entities: JSON.stringify(entities),
        duration_days: duration_days,
        optional_entities: has_optional ? JSON.stringify(optional_entities) : null
      }).then(function(created) {
        if (created) {
          return res.status(201).json({
            error: false,
            status: 201,
            message: 'created',
            body: {id: created.id}
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_action record',
          body: null
        })
      }).catch(function(err) {
        err = errors(err)
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

  // 20 GET /management/action/:user_id
  {
    uri: '/management/action/:user_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_id} = req.params
      var {user_action} = this.get('models')
      user_action.findAll({
        where: {owner_id: user_id}
      }).then(function(found) {
        if (found) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: found.map(function(action) {
              return {
                id: action.id,
                purpose: action.purpose
              }
            })
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to query user_action records',
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

  // 21 GET /management/action/:user_id/:action_id
  {
    uri: '/management/action/:user_id/:action_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_id, action_id} = req.params
      var {crypto_key, user_action} = this.get('models')
      var blank

      user_action.findOne({
        where: {
          owner_id: user_id,
          id: action_id
        }
      }).then(function(found) {
        if (found) {
          blank = {
            '@context': 'http://schema.cnsnt.io/information_sharing_agreement',
            isa: {
              requestSignatureValue: null,
              request: {
                purpose: found.purpose,
                license: found.license,
                entities: JSON.parse(found.entities),
                optionalEntities: JSON.parse(found.optional_entities),
                durationDays: found.duration_days,
                requestedBy: user_id,
                action: found.id
              }
            }
          }
          return crypto_key.findOne({
            where: {
              owner_id: user_id,
              alias: 'eis'
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_action record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          return our_crypto.asymmetric.sign(
            'secp256k1',
            found.private_key,
            JSON.stringify(blank.isa.request)
          )
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'crypto_key record not found',
          body: null
        })
      }).then(function(signature) {
        blank.isa.requestSignatureValue = signature.toString('base64')
        return Promise.resolve()
      }).then(function() {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: {document: blank}
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

  // 22 POST /management/isa/:user_id/:action_id
  {
    uri: '/management/isa/:user_id/:action_id',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      // NOTE
      // the client shouldn't have to post the action document that they're accepting
      // they should only have to reference the user and action id

      var {user_id, action_id} = req.params
      var {
        crypto_key,
        user_action,
        user_connection,
        information_sharing_agreement_request,
        information_sharing_agreement,
        information_sharing_permission,
        information_sharing_agreement_receipt
      } = this.get('models')

      var errors = this.get('db_errors')

      var isar_id, isa_id, {document} = req.body


      if (!document) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      var {isa} = document

      // TODO add more guards: ensure the document being posted matches the user/action ids

      if (typeof isa !== 'object' ||
          isa === null ||
          typeof isa.response !== 'object' ||
          isa.response === null ||
          (Array.isArray(isa.entities) && isa.entities.length)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      var expires_at = new Date
      expires_at.setDate(expires_at.getDate() + isa.request.durationDays)

      // TODO check for existing connection before continuing

      information_sharing_agreement_request.create({
        from_id: user_id,
        to_id: req.user.id,
        acknowledged: true,
        optional_schemas: JSON.stringify(isa.request.optionalEntities || []),
        requested_schemas: JSON.stringify(isa.request.entities),
        purpose: isa.request.purpose,
        license: isa.request.license,
        accepted: true,
        expires_at: expires_at,
        acknowledged_at: new Date,
        resolved_at: new Date
      }).then(function(created) {
        isar_id = created.id
        return information_sharing_agreement.create({
          isar_id: created.id,
          from_id: user_id,
          to_id: req.user.id
        })
      }).then(function(created) {
        isa_id = created.id
        return Promise.all(
          isa.response.entities.map(function(resource_id) {
            return information_sharing_permission.create({
              isa_id: created.id,
              user_datum_id: resource_id
            })
          })
        )
      }).then(function(created) {
        return crypto_key.findOne({
          where: {
            owner_id: req.user.id,
            alias: 'eis'
          }
        })
      }).then(function(found) {
        if (found) {
          return our_crypto.asymmetric.sign(
            'secp256k1',
            found.private_key,
            JSON.stringify(isa)
          )
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'crypto_key record not found',
          body: null
        })
      }).then(function(signature) {
        document.isaSignature = signature.toString('base64')
        document.isa.response.respondedBy = req.user.id
        document.isa.response.respondedAt = new Date
        document.isa.response.expiresAt = expires_at
        return information_sharing_agreement_receipt.create({
          isa_id: isa_id,
          isar_id: isar_id,
          receipt: JSON.stringify(document)
        })
      }).then(function(created) {
        process.send({
          notification_request: {
            user_id: user_id,
            notification: {
              title: 'Information Sharing Agreement Request Accepted',
              body: 'Your ISA request was accepted'
            },
            data: {
              type: 'information_sharing_agreement_request_accepted',
              isa_id: isa_id
            }
          }
        })
        return Promise.resolve()
      }).then(function() {
        return res.status(201).json({
          error: false,
          status: 201,
          message: 'created information_sharing_agreement record',
          body: {id: isa_id}
        })
      }).catch(function(err) {
        err = errors(err)
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

  // example
  // 
  // N METHOD /:VERSION/:URI
  // {
  //   uri: '/:VERSION/:URI',
  //   method: 'METHOD',
  //   secure: true, // authenticated?
  //   active: true, // activated?
  //   callback: function(req, res) {}
  // }
]