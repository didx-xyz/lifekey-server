
module.exports = [
  {
    uri: '/',
    method: 'get',
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
  {
    uri: '/debug/unregister/:user_id',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {user_id} = req.params.user_id
      var {user, user_device, crypto_key, user_datum} = this.get('models')
      user.destroy({
        where: {id: user_id}
      }).then(function() {
        return user_device.destroy({where: {owner_id: user_id}})
      }).then(function() {
        return crypto_key.destroy({where: {owner_id: user_id}})
      }).then(function() {
        return user_datum.destroy({where: {owner_id: user_id}})
      }).then(function() {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'deleted records, i think?',
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