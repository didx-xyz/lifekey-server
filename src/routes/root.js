
var crypto = require('../crypto')
var https = require('https')
var http = require('http')
var url = require('url')

var ec = require('eccrypto')

module.exports = [
  
  // 0 GET /
  {
    uri: '/',
    method: 'all',
    secure: false,
    active: false,
    callback: function(req, res) {
      return res.status(200).json({
        error: false,
        status: 200,
        message: 'sorry, there\'s nothing to see here...',
        body: null
      })
    }
  },
  
  // 1 GET /robots.txt
  {
    uri: '/robots.txt',
    method: 'all',
    secure: false,
    active: false,
    callback: function(req, res) {
      res.set('content-type', 'text/plain')
      return res.status(200).end(
        'User-agent: *\nDisallow: /'
      )
    }
  },
  
  // 2 GET /debug/unregister/:user_id
  {
    // DEBUG unsafe due to GET method
    uri: '/debug/unregister',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {email, did} = req.query
      if (!(email || did)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }
      var {
        user,
        user_action,
        user_device,
        crypto_key,
        user_datum,
        active_bot
      } = this.get('models')
      var errors = this.get('db_errors')
      user.findOne({
        where: email ?
        {email: email} :
        {did: did}
      }).then(function(found) {
        if (!found) {
          return Promise.reject({
            error: true,
            status: 404,
            message: 'user record not found',
            body: null
          })
        }
        return Promise.all([
          user.destroy({where: {id: found.id}}),
          user_action.destroy({where: {owner_id: found.id}}),
          user_device.destroy({where: {owner_id: found.id}}),
          crypto_key.destroy({where: {owner_id: found.id}}),
          user_datum.destroy({where: {owner_id: found.id}}),
          active_bot.destroy({where: {owner_id: found.id}})
        ])
      }).then(function(deletes) {
        var [
          user_deleted,
          user_action_deleted,
          user_device_deleted,
          crypto_key_deleted,
          user_datum_deleted
        ] = deletes
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'delete counts enclosed',
          body: {
            user: user_deleted,
            user_action: user_action_deleted,
            user_device: user_device_deleted,
            crypto_key: crypto_key_deleted,
            user_datum: user_datum_deleted
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

  // 3 POST /web-auth
  {
    uri: '/web-auth',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {

      var {
        auth_callback,
        nonce,
        session_id
      } = req.body

      if (!(auth_callback &&
            nonce &&
            session_id)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      try {
        var addr = url.parse(auth_callback)
      } catch (e) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'url not given for auth_callback',
          body: null
        })
      }

      if (!addr.hostname) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'could not determine hostname from given url',
          body: null
        })
      }

      var {crypto_key} = this.get('models')
      var errors = this.get('db_errors')

      crypto_key.findOne({
        where: {
          owner_id: req.user.id,
          alias: 'eis'
        }
      }).then(function(found) {
        if (!found) {
          return Promise.reject({
            error: true,
            status: 500,
            message: 'user has no eis key',
            body: null
          })
        }
        return Promise.all([
          crypto.asymmetric.sign(
            'secp256k1',
            found.private_key,
            nonce
          ),
          crypto.asymmetric.get_public('secp256k1', found.private_key)
        ])
      }).then(function(res) {
        var msg = JSON.stringify({
          nonce: nonce,
          session_id: session_id,
          signature: res[0].toString('base64'),
          public_key: res[1].toString('base64')
        })
        return Promise.resolve(Buffer.from(msg, 'utf8'))
      }).then(function(msg) {
        return new Promise(function(resolve, reject) {
          (addr.protocol === 'http:' ? http : https).request({
            method: 'post',
            protocol: addr.protocol,
            hostname: addr.hostname,
            path: addr.path,
            port: addr.port,
            headers: {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(msg)
            }
          }).on('response', function(res) {
            if (res.statusCode !== 200) {
              return reject({
                error: true,
                status: 403,
                message: 'remote service denied access',
                body: null
              })
            }
            return resolve()
          }).on('error', function(err) {
            return reject({
              error: true,
              status: 500,
              message: 'network transport error',
              body: null
            })
          }).end(msg)
        })
      }).then(function() {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
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
]