
'use strict'

// TODO query string parameters (limit,offset, etc)

module.exports = [
  
  // 0 GET /resource
  {
    uri: '/resource',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // list all entities
      var db = this.get('db')
      db.query('SELECT DISTINCT entity FROM user_data WHERE owner_id = :owner_id', {
        replacements: {owner_id: req.user.id},
        type: db.QueryTypes.SELECT
      }).then(function(found) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: found.length ? found.map(ud => ud.entity) : []
        })
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
  
  // 1 GET /resource/:entity
  {
    uri: '/resource/:entity',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // list all attributes
      var db = this.get('db')
      db.query('SELECT DISTINCT attribute FROM user_data WHERE entity = :entity AND owner_id = :owner_id', {
        type: db.QueryTypes.SELECT,
        replacements: {
          entity: req.params.entity,
          owner_id: req.user.id
        }
      }).then(function(found) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: found.length ? found.map(ud => ud.attribute) : []
        })
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
  
  // 2 GET /resource/:entity/:attribute
  {
    uri: '/resource/:entity/:attribute',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // list all aliases
      var db = this.get('db')
      var {entity, attribute} = req.params
      db.query('SELECT alias FROM user_data WHERE attribute = :attribute AND entity = :entity AND owner_id = :owner_id', {
        type: db.QueryTypes.SELECT,
        replacements: {
          attribute: attribute,
          entity: entity,
          owner_id: req.user.id
        }
      }).then(function(found) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'ok',
          body: found.length ? found.map(ud => ud.alias) : []
        })
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

  // 3 GET /resource/:entity/:attribute/:alias
  {
    uri: '/resource/:entity/:attribute/:alias',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {entity, attribute, alias} = req.params
      var {owner} = req.query
      var {
        information_sharing_permission,
        information_sharing_agreement,
        user_datum,
        user
      } = this.get('models')

      // user accessing another user's resources
      if (owner && owner.length) {
        information_sharing_agreement.findAll({
          where: {
            $and: [
              {
                $or: [
                  {from_id: req.user.id},
                  {from_did: req.user.did}
                ]
              },
              {
                $or: [
                  {to_id: owner},
                  {to_did: owner}
                ]
              }
            ]
          }
        }).then(function(found) {
          if (found && found.length) {
            return Promise.all(
              found.map(function(isa) {
                return information_sharing_permission.findAll({
                  where: {isa_id: isa.id}
                })
              })
            )
          }
          return Promise.reject({
            error: true,
            status: 404,
            message: 'information_sharing_agreement record(s) not found',
            body: null
          })
        }).then(function(found) {
          if (found && found.length) {
            var permitted = false
            found.forEach(function(permissions) {
              permissions.forEach(function(permission) {
                if (permission.resource_uri === `/resource/${entity}/${attribute}/${alias}`) permitted = true
              })
            })
            return permitted ? Promise.resolve() : Promise.reject({
              error: true,
              status: 400,
              // TODO this should actually be a 404 (covering the case that the calling agent is not permitted to access as well as the resource not existing)
              message: 'not permitted to access the requested resource',
              body: null
            })
          }
          return Promise.reject({
            error: true,
            status: 404,
            message: 'information_sharing_permission record(s) not found',
            body: null
          })
        }).then(function() {
          return user.findOne({
            where: {
              $or: [
                {id: owner},
                {did: owner}
              ]
            }
          })
        }).then(function(found) {
          if (found) {
            return user_datum.findOne({
              where: {
                owner_id: found.id,
                entity: entity,
                attribute: attribute,
                alias: alias
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
              body: found.toJSON()
            })
          }
          return Promise.reject({
            error: true,
            status: 404,
            message: 'user_datum record not found',
            body: null
          })
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
      } else {
        // user accessing their own resources
        user_datum.findOne({
          where: {
            owner_id: req.user.id,
            entity: entity,
            attribute: attribute,
            alias: alias
          }
        }).then(function(found) {
          if (found) {
            return Promise.resolve(
              res.status(200).json({
                error: false,
                status: 200,
                message: 'ok',
                body: found.toJSON()
              })
            )
          }
          return Promise.reject({
            error: true,
            status: 404,
            message: 'user_datum record not found',
            body: null
          })
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
    }
  },

  // 4 POST /resource/:entity/:attribute/:alias
  {
    uri: '/resource/:entity/:attribute/:alias',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {user_datum} = this.get('models')
      var {entity, attribute, alias} = req.params
      var {encoding, mime, value, is_default, is_archived} = req.body

      if (!value) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      user_datum.findOne({
        where: {
          owner_id: req.user.id,
          entity: entity,
          attribute: attribute,
          alias: alias
        }
      }).then(function(found) {
        if (found) {
          return Promise.reject({
            error: true,
            status: 400,
            message: `resource with alias ${alias} already exists`,
            body: null
          })
        }
        return user_datum.create({
          owner_id: req.user.id,
          entity: entity,
          attribute: attribute,
          value: value,
          alias: alias,
          mime: mime,
          encoding: encoding,
          is_default: is_default,
          is_archived: is_archived
        })
      }).then(function(created) {
        if (created) {
          return res.status(201).json({
            error: false,
            status: 201,
            message: 'created',
            body: `/resource/${entity}/${attribute}/${alias}`
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_datum record',
          body: null
        })
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

  // 5 PUT /resource/:entity/:attribute/:alias
  {
    uri: '/resource/:entity/:attribute/:alias',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {user_datum} = this.get('models')
      var {entity, attribute, alias} = req.params
      var {encoding, mime, value, is_default, is_archived} = req.body

      user_datum.findOne({
        where: {
          owner_id: req.user.id,
          entity: entity,
          attribute: attribute,
          alias: alias
        }
      }).then(function(found) {
        if (found) {
          var updatefields = {}
          if (typeof encoding !== 'undefined') updatefields.encoding = encoding
          if (typeof mime !== 'undefined') updatefields.mime = mime
          if (typeof value !== 'undefined') updatefields.value = value
          if (typeof is_default !== 'undefined') updatefields.is_default = is_default
          if (typeof is_archived !== 'undefined') updatefields.is_archived = is_archived
          return found.update(updatefields)
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_datum record not found',
          body: null
        })
      }).then(function(updated) {
        if (updated) {
          // TODO dispatch webhooks for concerned parties
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'user_datum record updated',
            body: updated.toJSON()
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to update user_datum record',
          body: null
        })
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

  // 6 DELETE /resource/:entity/:attribute/:alias
  {
    uri: '/resource/:entity/:attribute/:alias',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // archive an aliased datum

      var {entity, attribute, alias} = req.params
      var {user_datum} = this.get('models')

      user_datum.findOne({
        where: {
          owner_id: req.user.id,
          entity: entity,
          attribute: attribute,
          alias: alias
        }
      }).then(function(found) {
        if (found) return found.update({is_archived: true})
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user_datum record not found',
          body: null
        })
      }).then(function(updated) {
        return res.status(200).json({
          error: false,
          status: 200,
          message: 'user_datum record archived',
          body: null
        })
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

  // 7 GET /profile/:user_id
  {
    uri: '/profile/:user_id',
    method: 'get',
    secure: false,
    active: true,
    callback: function(req, res) {
      var {user_id} = req.params
      var {user} = this.get('models')

      user.findOne({
        where: {
          $or: [
            {id: user_id},
            {did: user_id}
          ]
        }
      }).then(function(found) {
        if (found) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: {
              user: {
                nickname: found.nickname,
                did: found.did
              }
            }
          })
        }
        return Promise.reject({
          error: true,
          status: 404,
          message: 'user record not found',
          body: null
        })
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
  }
]