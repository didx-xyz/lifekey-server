
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
      var {did, challenge} = req.body
      if (!(did && challenge)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }
      process.send({
        web_auth_request: {
          did: did,
          challenge: challenge
        }
      })
      return res.status(200).json({
        error: false,
        status: 200,
        message: 'ok',
        body: null
      })
    }
  }
]