
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
        actions_url,
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

        if (actions_url) {
          try {
            var actionhook = url.parse(actions_url)
          } catch (e) {
            caught = true
          } finally {
            if (caught || !actionhook.host) {
              return res.status(400).json({
                error: true,
                status: 400,
                message: (
                  caught ?
                  'expected string type for actions_url' :
                  'url not given for actions_url'
                ),
                body: null
              })
            }
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
          actions_url: actions_url,
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
              purpose: 'verify',
              alias: 'client-server-http',
              public_key: key_buffers[0]
            }),
            using_fingerprint ? crypto_key.create({
              owner_id: created_user_id,
              algorithm: 'rsa',
              purpose: 'verify',
              alias: 'fingerprint',
              public_key: fingerprint.public_key
            }) : null
          ])
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_device record',
          body: null
        })
      }).then(function() {
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
          },
          // TODO this kinda stuff needs to be wrapped up and i18n'ed
          send_email_request: {
            to: email,
            subject: 'LifeKey Account Activation',
            content: `<p>Hi ${nickname}!</p><p>Please <a href="http://${this.get('env').SERVER_HOSTNAME}/management/activation/${activation_code}">click here</a> to verify your email address and activate your account.</p>`,
            mime: 'text/html'
          }
        })
        return Promise.resolve()
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
      var {
        user,
        user_device,
        user_connection,
        user_connection_request
      } = this.get('models')
      var errors = this.get('db_errors')
      var ucr, target_user
      
      if (!target) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      if (req.user.did === target ||
          req.user.id === target ||
          (''+req.user.id) === target ||
          (''+req.user.did === target)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'you cannot connect to yourself',
          body: null
        })
      }
      
      // find any existing user_connection
      user_connection.findOne({
        where: {
          enabled: true,
          $and: [
            {
              $or: [
                {
                  from_did: req.user.did,
                  to_did: target
                },
                {
                  from_did: target,
                  to_did: req.user.did
                }
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
            body: null
          })
        }
        
        // find any existing unresponded-to connection request
        return user_connection_request.findOne({
          where: {
            acknowledged: null,
            accepted: null,
            $and: [
              {
                $or: [
                  {
                    from_did: req.user.did,
                    to_did: target
                  },
                  {
                    from_did: target,
                    to_did: req.user.did
                  }
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
            body: null
          })
        }

        return user.findOne({where: {did: target}})
      }).then(function(found) {
        // ensure target of ucr exists
        if (found) {
          target_user = found
          return user_connection_request.create({
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
              user_id: created.to_did,
              notification: {
                title: 'New Connection Request',
                body: `You have received a connection request from ${req.user.nickname}!`
              },
              data: {
                type: 'user_connection_request',
                is_user_connection_request: true,
                user_connection_request_id: created.id,
                ucr_id: created.id,
                // from_id: req.user.id,
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
                {to_did: req.user.did}
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
            to_did: req.user.did
          }
        })
      }).then(function(user_connection_requests) {
        if (user_connection_requests) {
          // append to data structure
          body.unacked = user_connection_requests.map(ucr => ucr.id)
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

      var {user, user_connection_request_id} = req.params
      var {accepted} = req.body
      var uc, ucr, requested_id // user id of target

      var {
        user,
        user_device,
        user_connection,
        user_connection_request
      } = this.get('models')
      var errors = this.get('db_errors')

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
          to_did: req.user.did
        }
      }).then(function(found) {
        if (found) {
          // accept/reject the ucr
          ucr = {
            to_did: found.to_did,
            from_did: found.from_did
          }
          return found.destroy()
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_connection_request record not found',
          body: null
        })
      }).then(function(destroyed) {
        if (accepted) {
          // update the associated uc record
          return Promise.all([
            user_connection.create({
              to_did: ucr.to_did,
              from_did: ucr.from_did,
              enabled: accepted
            }),
            user.findOne({where: {did: ucr.from_did}})
          ])
        } else if (!accepted) {
          return Promise.resolve(false)
        } else {
          return Promise.reject({
            error: true,
            status: 500,
            message: 'update failed',
            body: null
          })
        }
      }).then(function(create_find_delete) {
        if (create_find_delete) {
          uc = create_find_delete[0]
          var pnr_notif = {
            title: 'User Connection',
            body: 'User connection successfully created!'
          }, pnr_data = {
            type: 'user_connection_created',
            is_user_connection_created: true,
            user_connection_id: create_find_delete[0].id,
            uc_id: create_find_delete[0].id,
            to_did: ucr.to_did,
            actions_url: create_find_delete[1].actions_url,
            from_did: ucr.from_did
          }
          process.send({
            notification_request: {
              user_id: ucr.from_did,
              notification: pnr_notif,
              data: pnr_data
            }
          }, function() {
            process.send({
              notification_request: {
                user_id: ucr.to_did,
                notification: pnr_notif,
                data: pnr_data
              }
            })
          })
        }
        return Promise.resolve()
      }).then(function() {
        return Promise.resolve(
          accepted ? (
            res.status(201).json({
              error: false,
              status: 201,
              message: 'user_connection created',
              body: {id: uc.id}
            })
          ) : (
            res.status(200).json({
              error: false,
              status: 200,
              message: 'user_connection rejected',
              body: null
            })
          )
        )
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

  // 5 DELETE /management/connection/:user_connection_id
  {
    uri: '/management/connection/:user_connection_id',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_connection_id} = req.params
      var {user, user_connection} = this.get('models')
      var errors = this.get('db_errors')
      var uc
      
      user_connection.findOne({
        where: {
          id: user_connection_id,
          $and: [
            {
              $or: [
                {to_did: req.user.did},
                {from_did: req.user.did}
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
          return user.findOne({
            where: {
              did: req.user.did === uc.from_did ? uc.to_did : uc.from_did
            }
          })
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
        err = errors(err)
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
      var errors = this.get('db_errors')
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

  // 7 POST /management/isa/request
  {
    uri: '/management/isa',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {

      var {
        to,
        optional_entities,
        required_entities,
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
      
      if (!(Array.isArray(required_entities) && required_entities.length)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'expected lengthy arrayish type for required_entities field',
          body: null
        })
      }

      // required_entities
      // [
      //   {schema: 'Person', description: '...'},
      //   {schema: 'PostalAddress', description: 'work'}
      // ]

      var {
        user,
        user_connection,
        information_sharing_agreement_request
      } = this.get('models')
      var errors = this.get('db_errors')

      var to_user

      user.findOne({
        where: {
          did: to
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
                      to_did: req.user.did,
                      from_did: to
                    },
                    {
                      from_did: req.user.did,
                      to_did: to
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
            to_did: to_user.did,
            license: license,
            optional_entities: JSON.stringify(optional_entities),
            required_entities: JSON.stringify(required_entities),
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
              user_id: to_user.did,
              notification: {
                title: 'New Information Sharing Agreement',
                body: 'New information sharing agreement'
              },
              data: {
                type: 'information_sharing_agreement_request',
                from_did: req.user.did,
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

      if (accepted &&
          !(Array.isArray(permitted_resources) && 
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
      var errors = this.get('db_errors')

      var isar, isa, from_did

      information_sharing_agreement_request.findOne({
        where: {
          id: isar_id,
          acknowledged: null,
          to_did: req.user.did
        }
      }).then(function(found) {
        if (found) {
          isar = found
          from_did = found.from_did
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
              user_id: from_did,
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
            from_did: updated.from_did,
            to_did: updated.to_did
          })
        }
      }).then(function(created) {
        if (created) {
          process.send({
            notification_request: {
              user_id: from_did,
              notification: {
                title: 'Information Sharing Agreement Request Accepted',
                body: 'Your ISA request was accepted'
              },
              data: {
                type: 'information_sharing_agreement_request_accepted',
                isar_id: isar_id,
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
        err = errors(err)
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
      var errors = this.get('db_errors')
      
      var body = {
        unacked: [],
        enabled: [],
        disabled: []
      }
      
      information_sharing_agreement_request.findAll({
        where: {
          acknowledged: null,
          to_did: req.user.did
        }
      }).then(function(isars) {
        if (isars) {
          body.unacked = isars.map(isar => {
            return {
              id: isar.id,
              required_entities: JSON.parse(isar.required_entities)
            }
          })
        }
        return information_sharing_agreement.findAll({
          where: {
            to_did: req.user.did
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
      var errors = this.get('db_errors')
      var isa, isar, isps

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          $or: [
            {to_did: req.user.did},
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
      var errors = this.get('db_errors')

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          expired: false,
          $and: [
            {
              $or: [
                {to_did: req.user.did},
                {from_did: req.user.did}
              ]
            }
          ]
        }
      }).then(function(found) {
        if (found) {
          process.send({
            notification_request: {
              user_id: found.to_did,
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
              user_id: found.from_did,
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

  // 12 GET /qr/:user_id
  {
    uri: '/qr/:user_id',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {user_id} = req.params
      var {user} = this.get('models')
      var errors = this.get('db_errors')
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
            `${SERVER_HOSTNAME}/profile/${found.did || found.id}`,
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
      var errors = this.get('db_errors')

      var from_user

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          $and: [
            {
              $or: [
                {from_did: req.user.did},
                {to_did: req.user.did}
              ]
            }
          ]
        }
      }).then(function(found) {
        if (found && (
          // found.to_id === req.user.id ||
          found.to_did === req.user.did
        )) {
          from_user = found.from_did
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

  // 14 GET /management/isa/pull/:isa_id
  {
    uri: '/management/pull/:isa_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {isa_id} = req.params
      var {
        user,
        information_sharing_agreement,
        information_sharing_permission,
        user_datum
      } = this.get('models')
      var errors = this.get('db_errors')

      var isa, to_user, body = {}

      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          from_did: req.user.did
        }
      }).then(function(found) {
        if (found) {
          isa = found
          return user.findOne({where: {did: found.to_did}})
          // to_user = found.to_did
          // return Promise.resolve(found)
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'information_sharing_agreement record not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          to_user = found
          return Promise.resolve()
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
      }).then(function() {
        if (!isa.expired) {
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
                  owner_id: to_user.id,
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
          // TODO change this key name!!!
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
        user,
        information_sharing_agreement,
        user_datum
      } = this.get('models')
      var errors = this.get('db_errors')
      
      information_sharing_agreement.findOne({
        where: {
          id: isa_id,
          from_did: req.user.did
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
          return user.findOne({
            where: {
              did: (
                req.user.did === found.to_did ?
                found.from_did :
                found.to_did
              )
            }
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
          return Promise.all(
            resources.map(function(resource, idx) {
              return user_datum.create({
                owner_id: found.id,
                entity: resource.name,
                attribute: 'from ' + req.user.nickname,
                alias: idx + 1,
                mime: resource.mime,
                value: resource.value,
                uri: resource.uri,
                from_user_did: req.user.id,
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
          message: 'user record not found',
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
        return our_crypto.asymmetric.get_buffers(
          lower_algo,
          public_key,
          plaintext_proof,
          signed_proof
        )
      }).then(function(keys) {
        key_buffers = keys
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
        if (created) {
          return crypto_key.create({
            algorithm: public_key_algorithm,
            purpose: purpose || 'sign',
            alias: alias,
            public_key: lower_algo === 'rsa' ? public_key : key_buffers[0],
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
    uri: '/management/key/:user_did',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_did} = req.params
      var {alias} = req.query
      var {user, crypto_key} = this.get('models')
      var errors = this.get('db_errors')

      user.findOne({
        where: {
          did: user_did
        }
      }).then(function(found) {
        if (found) {
          var query = {
            where: {
              owner_id: found.id,
              alias: 'client-server-http'
            }
          }
          if (alias) query.where.alias = alias
          return crypto_key.findOne(query)
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
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

  // 19 POST /management/action
  {
    uri: '/management/action',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {
        name, purpose, license, entities,
        optional_entities, duration_days
      } = req.body

      var has_optional = false

      if (!(name &&
            purpose &&
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

      if (/\s+/i.test(name)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'name cannot contain whitespace',
          body: null
        })
      }

      if (Array.isArray(optional_entities) &&
          optional_entities.length) {
        has_optional = true
      }

      var errors = this.get('db_errors')
      var {user_action} = this.get('models')

      user_action.findOne({
        where: {
          name: name,
          owner_id: req.user.id
        }
      }).then(function(found) {
        if (found) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'user_action record already exists',
            body: null
          })
        }
        return user_action.create({
          owner_id: req.user.id,
          name: name,
          purpose: purpose,
          license: license,
          entities: JSON.stringify(entities),
          duration_days: duration_days,
          optional_entities: (
            has_optional ?
            JSON.stringify(optional_entities) :
            null
          )
        })
      }).then(function(created) {
        if (created) {
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

  // 20 GET /management/action/:user_did
  {
    uri: '/management/action/:user_did',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_did} = req.params
      var {user, user_action} = this.get('models')
      var errors = this.get('db_errors')

      user.findOne({
        where: {did: user_did}
      }).then(function(found) {
        if (found) {
          return user_action.findAll({
            where: {owner_id: found.id}
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
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: found.map(function(action) {
              return {
                name: action.name,
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

  // 21 GET /management/action/:user_did/:action_name
  {
    uri: '/management/action/:user_did/:action_name',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {user_did, action_name} = req.params
      var {user, user_action} = this.get('models')
      var errors = this.get('db_errors')

      var action_owner_id
      user.findOne({
        where: {did: user_did}
      }).then(function(found) {
        if (found) {
          return user_action.findOne({
            where: {
              owner_id: found.id,
              name: action_name
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
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: {
              purpose: found.purpose,
              license: found.license,
              entities: JSON.parse(found.entities),
              optionalEntities: JSON.parse(found.optional_entities),
              durationDays: found.duration_days,
              requestedBy: user_did,
              name: found.name
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_action record not found',
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

  // 22 POST /management/isa/:user_did/:action_name
  {
    uri: '/management/isa/:user_id/:action_name',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {

      // NOTE
      // the client shouldn't have to post the action document that they're accepting
      // they should only have to reference the user and action id

      var {user_did, action_name} = req.params
      var {
        user,
        crypto_key,
        user_action,
        user_connection,
        information_sharing_agreement_request,
        information_sharing_agreement,
        information_sharing_permission,
        information_sharing_agreement_receipt
      } = this.get('models')

      var errors = this.get('db_errors')
      var isar_id, isa_id, {entities, optional_entities} = req.body
      
      if (!(Array.isArray(entities) && entities.length)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }
      
      user.findOne({
        where: {did: user_did}
      }).then(function(found) {
        if (found) {
          return user_action.findOne({
            where: {
              owner_id: found.id,
              name: action_name
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
          var expires_at = new Date
          expires_at.setDate(expires_at.getDate() + found.duration_days)
          return information_sharing_agreement_request.create({
            from_did: user_did,
            to_did: req.user.did,
            action_id: found.id,
            acknowledged: true,
            optional_entities: JSON.stringify(optional_entities || []),
            required_entities: JSON.stringify(entities),
            duration_days: found.duration_days,
            purpose: found.purpose,
            license: found.license,
            accepted: true,
            expires_at: expires_at,
            acknowledged_at: new Date,
            resolved_at: new Date
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_action record not found',
          body: null
        })
      }).then(function(created) {
        isar_id = created.id
        return information_sharing_agreement.create({
          isar_id: created.id,
          from_did: user_did,
          to_did: req.user.did
        })
      }).then(function(created) {
        isa_id = created.id
        return Promise.all(
          entities.map(function(resource_id) {
            return information_sharing_permission.create({
              isa_id: created.id,
              user_datum_id: resource_id
            })
          })
        )
      }).then(function(created) {
        process.send({
          notification_request: {
            user_id: user_did,
            notification: {
              title: 'Information Sharing Agreement Request Accepted',
              body: 'Your ISA request was accepted'
            },
            data: {
              type: 'information_sharing_agreement_request_accepted',
              via_action: true,
              isar_id: isar_id,
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
  },

  // 23 GET /management/receipt/:isa_id
  {
    uri: '/management/receipt/:isa_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {isa_id} = req.params
      var {
        user,
        crypto_key,
        information_sharing_agreement,
        information_sharing_agreement_request
      } = this.get('models')
      var errors = this.get('db_errors')

      var isar, receipt

      information_sharing_agreement.findOne({
        where: {id: isa_id}
      }).then(function(found) {
        if (found) {
          if (found.to_did === req.user.did || found.from_did === req.user.did) {
            return information_sharing_agreement_request.findOne({
              where: {id: found.isar_id}
            })
          }
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
          receipt = {
            '@context': 'http://schema.cnsnt.io/information_sharing_agreement',
            isaSignatureValue: null,
            isa: {
              requestSignatureValue: null,
              request: {
                purpose: isar.purpose,
                license: isar.license,
                entities: JSON.parse(isar.required_entities),
                optionalEntities: JSON.parse(isar.optional_entities),

                // TODO requires data model change
                // durationDays: isar.duration_days,
                requestedBy: isar.from_did,
                action: isar.action_id // FIXME query the action name
              },
              response: {
                respondedBy: isar.to_did
              }
            }
          }
          return user.findOne({
            where: {did: isar.from_did}
          })
        } else {
          return Promise.reject({
            error: true,
            status: 404,
            message: 'information_sharing_agreement_request record not found',
            body: null
          })
        }
      }).then(function(found) {
        if (found) {
          return crypto_key.findOne({
            where: {
              owner_id: found.id,
              alias: 'eis'
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
          return our_crypto.asymmetric.sign(
            'secp256k1',
            found.private_key,
            JSON.stringify(receipt.isa.request)
          )
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'crypto_key record not found',
          body: null
        })
      }).then(function(signature) {
        receipt.isa.requestSignatureValue = signature.toString('base64')
        return user.findOne({
          where: {did: isar.from_did}
        })
      }).then(function(found) {
        if (found) {
          return crypto_key.findOne({
            where: {
              owner_id: found.id,
              alias: 'eis'
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
          return our_crypto.asymmetric.sign(
            'secp256k1',
            found.private_key,
            JSON.stringify(receipt.isa)
          )
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'crypto_key record not found',
          body: null
        })
      }).then(function(signature) {
        receipt.isaSignatureValue = signature.toString('base64')
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: receipt
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

  // 24 DELETE /management/action/:action_name
  {
    uri: '/management/action/:action_name',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {action_name} = req.params
      var {user_action} = this.get('models')
      var errors = this.get('db_errors')

      user_action.destroy({
        where: {
          owner_id: req.user.id,
          name: action_name
        }
      }).then(function(deleted) {
        if (deleted) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: {user_action: deleted}
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_action record not found',
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