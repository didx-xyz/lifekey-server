
// TODO
// add flags for token expiry

// TODO
// add flags for control over token generation

// TODO
// resolve this data structure dynamically (over the network)

var CNSNT_SCHEMA_HOST = 'http://schema.cnsnt.io/'
var CONNECTION_REQUEST_CTX = {
  '@context': {
    id: '@id',
    type: '@type',
    cn: 'http://schema.cnsnt.io/',
    from: 'cn:from',
    to: 'cn:to',
    resolution: 'cn:resolution',
    resolverSignature: 'cn:resolverSignature',
    dateAcknowledged: 'cn:dateAcknowledged',
    dateResolved: 'cn:dateResolved'
  }
}

var crypto = require('crypto')

require('an.hour.ago')
var jsonld = require('jsonld')
var query = require('ld-query')
var scrypt = require('scrypt')

module.exports = [
  
  // 0 post /management/register
  {
    uri: '/management/register',
    method: 'post',
    callback: function(req, res) {
      var {email, password} = req.body
      if (!(email && password)) {
        res.status(400)
        return res.json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }
      var {user} = this.get('models')
      
      user.findOne({where: {email: email}}).then(function(found) {
        if (found) {
          return Promise.reject({
            error: true,
            status: 400,
            message: 'user already exists',
            body: null
          })
        }
        return scrypt.params(0.1)
      }).then(function(params) {
        return scrypt.kdf(password, params)
      }).then(function(hashed) {
        return user.create({
          // did: did,
          // first_name: firstName,
          // last_name: lastName,
          email: email,
          password: hashed
        })
      }).then(function(created) {
        res.status(201)
        return res.json({
          error: false,
          status: 201,
          message: 'created',
          body: {id: created.id}
        })
      }).catch(function(err) {
        
        res.status(err.status || 500)
        return res.json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 1 post /management/token
  {
    uri: '/management/token',
    method: 'post',
    callback: function(req, res) {
      
      var newtoken, newexpiry = 1..day.from_now
      
      // TODO
      // enumerate existing tokens for user if password verified
      // and don't issue new token unless current token has expired
      
      var {email, password} = req.body
      if (!(email && password)) {
        res.status(400)
        return res.json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }
      
      var userid, { // userid for token creation foreign key
        user, token
      } = this.get('models')
      
      Promise.resolve().then(function() {
        return user.findOne({where: {email: email}})
      }).then(function(found) {
        if (found) {
          userid = found.id
          return scrypt.verifyKdf(found.password, password)
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(verified) {
        if (verified) {
          newtoken = crypto.randomBytes(32)
          return token.upsert({
            owner_id: userid,
            value: newtoken.toString('hex'), // how sophisticated :/
            expires_at: newexpiry
          })
        }
        return Promise.reject({
          error: true,
          status: 403,
          message: 'hash verification failure',
          body: null
        })
      }).then(function(upserted) {
        if (upserted) {
          res.status(200)
          return res.json({
            error: false,
            status: 200,
            message: 'token created',
            body: {
              token: newtoken.toString('hex'),
              expires_at: newexpiry.getTime()
            }
          })
        }
      }).catch(function(err) {
        
        res.status(err.status || 500)
        return res.json({
          error: err.error,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 2 post /management/device
  {
    uri: '/management/device',
    method: 'post',
    callback: function(req, res) {
      var {user, token, user_device} = this.get('models')

      var userid
      
      var reqtoken = req.body.token
      var {email, device_id, platform} = req.body

      if (!(email && reqtoken && device_id && platform)) {
        res.status(400)
        return res.json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }

      user.findOne({where: {email: email}}).then(function(found) {
        if (found) {
          return token.findOne({
            where: {
              owner_id: found.id,
              value: reqtoken
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          if (found.expires_at.getTime() <= Date.now()) {
            return Promise.reject({
              error: true,
              status: 401,
              message: 'token expired',
              body: null
            })
          }
          return user_device.upsert({
            user_id: found.owner_id,
            device_id: device_id,
            platform: platform
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'token not found',
          body: null
        })
      }).then(function(upserted) {
        if (upserted) {
          res.status(200)
          return res.json({
            error: false,
            status: 200,
            message: 'device_id saved',
            body: null
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'device record not created',
          body: null
        })
      }).catch(function(err) {
        res.status(err.status || 500)
        return res.json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 3 post /management/connection
  {
    uri: '/management/connection',
    method: 'post',
    callback: function(req, res) {
      // send a connection request

      var email = req.body.email, requester_id
      var document = req.body.document
      var requesting_id = req.body.target
      var reqtoken = req.body.token

      if (!(email && reqtoken)) {
        res.status(400)
        return res.json({
          error: true,
          status: 400,
          message: 'missing request body parameters',
          body: null
        })
      }
      // if (!(email && document && reqtoken) || !(email && requesting_id && reqtoken)) {
      //   res.status(400)
      //   return res.json({
      //     error: true,
      //     status: 400,
      //     message: 'missing request body parameters',
      //     body: null
      //   })
      // }

      var {user, token, user_connection_request} = this.get('models')

      // intersperse the OPTIONAL jsonld document
      // querying with the existing promise composition
      ;(function() {
        if (document) {
          try {
            document = JSON.parse(document)
          } catch (e) {
            return Promise.reject({
              error: true,
              status: 400,
              message: 'expected well-formed and validatable json string',
              body: null
            })
          }
          return jsonld.promises.compact(
            document, CONNECTION_REQUEST_CTX
          ).then(function(compacted) {
            return jsonld.promises.expand(compacted)
          }).then(function(expanded) {
            var q = query(expanded, {cn: CNSNT_SCHEMA_HOST})
            requesting_id = q.query('cn:to @value')
            var vartype = typeof requesting_id
            if (vartype !== 'number') {
              return Promise.reject({
                error: true,
                status: 400,
                message: `expected 'number' type for 'to' field but got ${vartype}`,
                body: null
              })
            }
            return Promise.resolve()
          })
        } else if (!requesting_id) {
          return Promise.reject({
            error: true,
            status: 400,
            message: `expected 'number' type for 'to' field but got ${vartype}`,
            body: null
          })
        } else {
          return Promise.resolve()
        }
      })(document).then(function() {
        return user.findOne({where: {email: email}})
      }).then(function(found) {
        if (found) {
          
          if (found.id === requesting_id) {
            return Promise.reject({
              error: true,
              status: 400,
              message: 'you cannot connect to yourself',
              body: null
            })
          }
          
          requester_id = found.id
          return token.findOne({
            where: {
              owner_id: found.id,
              value: reqtoken
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          if (found.expires_at.getTime() <= Date.now()) {
            return Promise.reject({
              error: true,
              status: 401,
              message: 'token expired',
              body: null
            })
          }
          return user.findOne({where: {id: requesting_id}})
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'token not found',
          body: null
        })
      }).then(function(found) {
        // ensure target of ucr exists
        if (found) {
          return user_connection_request.create({
            to_id: found.id,
            from_id: requester_id,
            document: req.body.document
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
          res.status(200)
          return res.json({
            error: true,
            status: 200,
            message: 'connection request created',
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
        res.status(err.status || 500)
        return res.json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 4 get /management/connection
  {
    uri: '/management/connection',
    method: 'get',
    callback: function(req, res) {
      var {user, token, user_connection, user_connection_request} = this.get('models')
      var email = req.body.email, reqtoken = req.body.token

      var userid
      var ret_body = {}

      user.findOne({where: {email: email}}).then(function(found) {
        if (found) {
          userid = found.id
          return token.findOne({where: {value: reqtoken}})
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          if (found.expires_at.getTime() <= Date.now()) {
            return Promise.reject({
              error: true,
              status: 401,
              message: 'token expired',
              body: null
            })
          }
          return user_connection.findAll({
            where: {
              enabled: true,
              $and: [{
                $or: [
                  {from_id: userid}, 
                  {to_id: userid}
                ]
              }]
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'token not found',
          body: null
        })
      }).then(function(user_connections) {
        if (user_connections) ret_body.enabled = user_connections.map(uc => uc.id)
        else ret_body.enabled = []
        return user_connection_request.findAll({
          where: {
            acknowledged: null,
            to_id: userid
          }
        })
      }).then(function(user_connection_requests) {
        if (user_connection_requests) ret_body.unacked = user_connection_requests.map(ucr => ucr.id)
        else ret_body.unacked = []
        res.status(200)
        return res.json({
          error: false,
          status: 200,
          message: 'ok',
          body: ret_body
        })
      }).catch(function(err) {
        
        res.status(err.status || 500)
        return res.json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  
  // 5 post /management/connection/:id
  {
    uri: '/management/connection/:id',
    method: 'post',
    callback: function(req, res) {

      var connection_request_id = req.params.id

      var {email, accepted, document} = req.body
      var reqtoken = req.body.token
      var requested_id // user id of target
      
      var {user, user_connection, token, user_connection_request} = this.get('models')

      ;(function() {
        if (document) {
          try {
            document = JSON.parse(document)
          } catch (e) {
            return Promise.reject({
              error: true,
              status: 400,
              message: 'expected well-formed and validatable json string',
              body: null
            })
          }
          return jsonld.promises.compact(
            document, CONNECTION_REQUEST_CTX
          ).then(function(compacted) {
            return jsonld.promises.expand(compacted)
          }).then(function(expanded) {
            var q = query(expanded, {cn: CNSNT_SCHEMA_HOST})
            requested_id = q.query('cn:from @value')
            accepted = q.query('cn:resolution @value') || false
            var vartype = typeof requested_id
            if (vartype !== 'number') {
              return Promise.reject({
                error: true,
                status: 400,
                message: `expected 'number' type for 'from' field but got ${vartype}`,
                body: null
              })
            }
            return Promise.resolve()
          })
        }
        return Promise.resolve()
      })(document).then(function() {
        return user.findOne({where: {email: email}})
      }).then(function(found) {
        if (found) {
          // save target user id
          requested_id = found.id
          return token.findOne({where: {value: reqtoken}})
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(found) {
        // ensure validity of token
        if (found) {
          if (found.expires_at.getTime() <= Date.now()) {
            return Promise.reject({
              error: true,
              status: 401,
              message: 'token expired',
              body: null
            })
          }
          // then find the unacked ucr
          return user_connection_request.findOne({
            where: {
              to_id: requested_id,
              acknowledged: null,
              accepted: null
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'token not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          // accept/reject the ucr
          // user_connection_request_record = found
          return found.update({
            acknowledged: true,
            accepted: accepted
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user connection request not found',
          body: null
        })
      }).then(function(updated) {
        if (updated) {
          // TODO
          // push notify creator of ucr
          
          // update the associated uc record
          return user_connection.create({
            to_id: updated.to_id,
            from_id: updated.from_id,
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
          res.status(200)

          // node generates a warning if this res.json
          // call is NOT wrapped in a promise
          return Promise.resolve(res.json({
            error: false,
            status: 200,
            message: 'ok',
            body: null
          }))
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'user connection creation failed',
          body: null
        })
      }).catch(function(err) {
        
        res.status(err.status || 500)
        return res.json({
          error: err.error || true,
          status: err.status || 500,
          message: err.message || 'internal server error',
          body: err.body || null
        })
      })
    }
  },
  {
    uri: '/management/connection/:did',
    method: 'put',
    callback: function(req, res) {
      // update the `enabled` boolean
    }
  },
  {
    uri: '/management/permission/:did',
    method: 'post',
    callback: function(req, res) {}
  },
  {
    uri: '/management/permission/:did',
    method: 'get',
    callback: function(req, res) {}
  },
  {
    uri: '/management/receipt',
    method: 'get',
    callback: function(req, res) {}
  },
  {
    uri: '/management/key',
    method: 'get',
    callback: function(req, res) {
      // TODO
      // list key aliases
    }
  },
  {
    uri: '/management/key/:alias',
    method: 'get',
    callback: function(req, res) {}
  },
  {
    uri: '/management/key',
    method: 'post',
    callback: function(req, res) {
      // TODO
      // create key identified by `alias`
      // include the notion of reserved aliases
    }
  },
  {
    uri: '/management/key/:alias',
    method: 'delete',
    callback: function(req, res) {
      // TODO
      // delete key identified by `alias`
      // include the notion of reserved aliases
    }
  }
]