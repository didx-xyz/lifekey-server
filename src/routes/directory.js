
'use strict'

  function getConnectedBots(user, user_connection, userId) {
    return new Promise((Resolve, Reject) => {
      if(userId){
          return user.findOne({where: {id: userId}}).then(function(foundUser){
            if(!foundUser || !foundUser.did){
              return Resolve(null)
            }
            user_connection.findAll({
            where: {
              enabled: true,
              from_did: foundUser.did
            }
          
          }).then(connections => {
            var connectionsArr = [];
            connections.forEach(user_conn => {
              connectionsArr.push(user.findOne({attributes: ['id'], where: {did: user_conn.to_did},
              raw: true})
            )})
            Resolve(Promise.all(connectionsArr))
          })
        })
      }else{
        Resolve(null)
      }
    })
  }


module.exports = [

  // 0 GET /directory
  {
    uri: '/directory',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {active_bot, user, user_connection} = this.get('models')
      var errors = this.get('db_errors')
      var userId = req.headers['x-cnsnt-id'];
      
      
      getConnectedBots(user, user_connection, userId)
      .then(function(connectedBots){
        console.log(connectedBots)
        active_bot.findAll().then(function(found) {
          var now = new Date
          return Promise.all(
            found.filter(function(bot) {
              return (now.getTime() - bot.last_ping.getTime()) <= (2000 * 60)
            }).filter(function(bot){
              if(!connectedBots || connectedBots.length === 0){//
                return true;
              }
              var alreadyConnected = false;
              connectedBots.forEach(function (connBot) {
                if (connBot.id === bot.owner_id){
                  alreadyConnected = true;// only exclude if in list
                }
             })
             return !alreadyConnected
            }).map(function(bot) {
              return user.findOne({where: {id: bot.owner_id}})
            })
          )
        
      }).then(function(all) {
        console.log(`retutning ${all}`)
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: !all?'':all.map(function(user) {
            return {
              display_name: user.display_name,
              nickname: user.nickname,
              did: user.did,
              actions_url: user.actions_url,
              host_address: user.host_address,
              image_uri: user.branding_image_uri
            }
          })
        })
      })
      }).catch(function(err) {
        console.error(err)
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
      console.log('bot ping from', req.user.nickname, 'at', req.headers['x-real-ip'])

      req.user.update({
        host_address: req.headers['x-real-ip']
      }, {where: {
        owner_id: req.user.id
      }}).then(function() {
        return active_bot.upsert({
          last_ping: new Date,
          owner_id: req.user.id
        }, {where: {
          owner_id: req.user.id
        }})
      }).then(function(upserted) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: 'pong'
        })
      }).catch(function(err) {
        err = errors(err)
        console.log(err.body.validation_errors)
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
