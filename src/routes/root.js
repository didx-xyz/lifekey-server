
var crypto = require('crypto')
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
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      res.set('content-type', 'text/plain')
      return res.status(200).end('User-agent: *\nDisallow: /')
    }
  },
  
  // 2 GET /debug/unregister/:user_id
  {
    uri: '/debug/unregister',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {user_id, email} = req.query
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
        {id: user_id}
      }).then(function(found) {
        if (found) {
          return Promise.all([
            user.destroy({where: {id: found.id}}),
            user_action.destroy({where: {owner_id: found.id}}),
            user_device.destroy({where: {owner_id: found.id}}),
            crypto_key.destroy({where: {owner_id: found.id}}),
            user_datum.destroy({where: {owner_id: found.id}}),
            active_bot.destroy({where: {owner_id: found.id}})
          ])
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
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
          message: 'ok',
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
          message: 'url could not be parsed',
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
      }).then(function(key) {
        if (!key) {
          return Promise.reject({
            error: true,
            status: 500,
            message: 'user has no eis key',
            body: null
          })
        }

        var digest = crypto.createHash('sha256').update(nonce).digest()

        return Promise.all([
          digest.toString('base64'),
          ec.sign(digest, key.private_key),
          key.public_key.toString('base64')
        ])
      }).then(function(res) {
        var msg = JSON.stringify({
          nonce: nonce,
          session_id: session_id,
          digest: res[0],
          signature: res[1].toString('base64'),
          public_key: res[2]
        })
        return Promise.resolve(Buffer.from(msg, 'utf8'))
      }).then(function(msg) {
        return new Promise(function(resolve, reject) {
          http.request({
            method: 'post',
            protocol: addr.protocol,
            hostname: addr.hostname,
            path: addr.path,
            port: addr.port,
            headers: {
              'content-type': 'application/json',
              'content-length': Buffer.length(msg)
            }
          }).on('response', function(res) {
            if (res.status !== 200) {
              return reject({
                error: true,
                status: 403,
                message: 'remote service denied access',
                body: null
              })
            }
            return resolve()
          }).on('error', function(err) {
            console.log('error reaching remote service for auth hook')
            return reject({
              error: true,
              status: 500,
              message: 'network transport error',
              body: null
            })
          }).end(msg.toString('utf8'))
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