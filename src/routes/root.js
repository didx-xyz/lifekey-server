
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
    uri: '/debug/unregister/:user_id',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {user_id} = req.params.user_id
      var {user, user_device, crypto_key, user_datum} = this.get('models')
      Promise.all([
        user.destroy({where: {id: user_id}}),
        user_device.destroy({where: {owner_id: user_id}}),
        crypto_key.destroy({where: {owner_id: user_id}}),
        user_datum.destroy({where: {owner_id: user_id}})
      ]).then(function(deletes) {
        var [
          user_deleted,
          user_device_deleted,
          crypto_key_deleted,
          user_datum_deleted
        ] = deletes
        return res.status(200).json({
          error: false,
          status: 200,
          message: `deleted {{ ${user_deleted} users, ${user_device_deleted} user_devices, ${crypto_key_deleted} crypto_keys, and ${user_datum_deleted} user_data`,
          body: null
        })
      }).catch(function(err) {
        return res.status(err.status || 500).json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  }
]