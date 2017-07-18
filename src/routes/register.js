
var url = require('url')
var crypto = require('crypto')

var web3 = require('web3')
var qr = require('qrcode')
var cuid = require('cuid')

var env = require('../init/env')()

var our_crypto = require('../crypto')

var TESTING = process.env._.indexOf('istanbul') >= 0

if (TESTING) {
  // running from inside test suite
  // monkey-patch process so we can spy on its method calls
  Object.assign(process, require('../../test/spies/process'))
}

module.exports = {
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
      web_auth_url,
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
        }
        is_programmatic_user = true
        caught = false
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
          caught = false
        }
      }

      if (web_auth_url) {
        try {
          var web_auth_hook = url.parse(web_auth_url)
        } catch (e) {
          caught = true
        } finally {
          if (caught || !web_auth_hook.host) {
            return res.status(400).json({
              error: true,
              status: 400,
              message: (
                caught ?
                'expected string type for web_auth_url' :
                'url not given for web_auth_url'
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
      user_datum,
      crypto_key,
      http_request_verification,
      active_bot
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
        web_auth_url: web_auth_url,
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
          is_programmatic_user ? null : (
            user_datum.create({
              owner_id: created_user_id,
              entity: 'me',
              attribute: 'email',
              alias: 'My Email',
              value: JSON.stringify({
                '@context': 'http://schema.cnsnt.io/contact_email',
                email: email,
                createdDate: new Date,
                modifiedDate: new Date
              }),
              is_verifiable_claim: false,
              schema: 'schema.cnsnt.io/contact_email',
              mime: 'application/ld+json',
              encoding: 'utf8'
            })
          ),
          is_programmatic_user ? null : (
            user_datum.create({
              owner_id: created_user_id,
              entity: 'person',
              attribute: 'person',
              alias: 'My person profile',
              mime: 'application/ld+json',
              encoding: 'utf8',
              schema: 'schema.cnsnt.io/person',
              value: JSON.stringify({
                '@context': ['http://schema.cnsnt.io/person'],
                firstName: nickname,
                lastName: null,
                title: null,
                nationality: null,
                birthPlace: null,
                birthDate: null,
                alias: nickname,
                avatar: null,
                identityPhotograph: null,
                maritalStatus: null,
                maritalContractType: null,
                preferredLanguage: null,
                createdDate: new Date,
                modifiedDate: null
              }),
            })
          ),
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
          using_fingerprint ? (
            crypto_key.create({
              owner_id: created_user_id,
              algorithm: 'rsa',
              purpose: 'verify',
              alias: 'fingerprint',
              public_key: fingerprint.public_key
            })
          ) : null
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
      if (is_programmatic_user) {
        return active_bot.create({
          owner_id: created_user_id,
          last_ping: new Date
        })
      }
      return Promise.resolve()
    }).then(function() {
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
}
