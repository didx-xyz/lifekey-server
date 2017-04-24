
'use strict'

module.exports = [
  
  // 0 GET /directory
  {
    uri: '/directory',
    method: 'get',
    secure: true,
    active: false,
    callback: function(req, res) {
      var {active_bot, user} = this.get('models')
      var errors = this.get('db_errors')
      active_bot.findAll().then(function(found) {
        var now = new Date
        return Promise.all(
          found.filter(function(bot) {
            return (now.getTime() - bot.last_ping.getTime()) > (2000 * 60)
          }).map(function(bot) {
            return user.findOne({where: {id: bot.owner_id}})
          })
        )
      }).then(function(all) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: all.map(function(user) {
            return {
              display_name: user.display_name,
              nickname: user.nickname,
              did: user.did,
              actions_url: user.actions_url
            }
          })
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

  // 1 POST /directory/ping
  {
    uri: '/directory/ping',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      var {active_bot} = this.get('models')
      var errors = this.get('db_errors')
      active_bot.update({
        last_ping: new Date
      }, {where: {
        owner_id: req.user.id
      }}).then(function(updated) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: 'pong'
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