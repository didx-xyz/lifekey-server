
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
      var {pushed} = req.query
      var db = this.get('db')
      if (pushed) {
        db.query([
          'SELECT id, entity, attribute, alias',
          'FROM user_data',
          'WHERE owner_id = :owner_id AND',
          'from_user_id IS NOT NULL',
          'ORDER BY entity, attribute, alias ASC'
        ].join(' '), {
          replacements: {owner_id: req.user.id},
          type: db.QueryTypes.SELECT
        }).then(function(found) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: found.length ? found : []
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
        db.query([
          'SELECT id, entity, attribute, alias',
          'FROM user_data',
          'WHERE owner_id = :owner_id AND',
          'from_user_id IS NULL',
          'ORDER BY entity, attribute, alias ASC'
        ].join(' '), {
          replacements: {owner_id: req.user.id},
          type: db.QueryTypes.SELECT
        }).then(function(found) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: found.length ? found : []
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

  // 1 GET /resource/:resource_id
  {
    uri: '/resource/:resource_id',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {resource_id} = req.params
      var {user_datum} = this.get('models')

      // user accessing their own resources
      user_datum.findOne({
        where: {
          owner_id: req.user.id,
          id: resource_id
        }
      }).then(function(found) {
        if (found) {
          found.value = (
            found.value && found.encoding ?
            found.value.toString(found.encoding) :
            found.value
          )
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
  },

  // 2 POST /resource
  {
    uri: '/resource',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {
        entity, attribute, alias,
        encoding, mime, value, uri,
        schema, is_default, is_archived
      } = req.body

      if (!(entity && attribute && alias && value)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'missing required arguments',
          body: null
        })
      }

      var {user_datum} = this.get('models')

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
          schema: schema,
          uri: uri,
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
            body: {id: created.id}
          })
        }
        return Promise.reject({
          error: true,
          status: 500,
          message: 'unable to create user_datum record',
          body: null
        })
      }).catch(function(err) {
        console.log(err)
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

  // 3 PUT /resource/:resource_id
  {
    uri: '/resource/:resource_id',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {resource_id} = req.params
      var {user_datum} = this.get('models')
      var {
        entity,
        attribute,
        alias,
        schema,
        uri,
        encoding,
        mime,
        value,
        is_default,
        is_archived
      } = req.body
      
      var updatefields = {}
      if (typeof entity !== 'undefined') updatefields.entity = entity
      if (typeof attribute !== 'undefined') updatefields.attribute = attribute
      if (typeof alias !== 'undefined') updatefields.alias = alias
      if (typeof schema !== 'undefined') updatefields.schema = schema
      if (typeof uri !== 'undefined') updatefields.uri = uri
      if (typeof encoding !== 'undefined') updatefields.encoding = encoding
      if (typeof mime !== 'undefined') updatefields.mime = mime
      if (typeof value !== 'undefined') updatefields.value = value
      if (typeof is_default !== 'undefined') updatefields.is_default = is_default
      if (typeof is_archived !== 'undefined') updatefields.is_archived = is_archived
      
      return user_datum.update(updatefields, {
        where: {
          owner_id: req.user.id,
          id: resource_id
        }
      }).then(function(updated) {
        if (updated[0] > 0) {
          // TODO dispatch webhooks for concerned parties
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'user_datum record updated',
            body: null
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
    }
  },

  // 4 DELETE /resource/:resource_id
  {
    uri: '/resource/:resource_id',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // archive an aliased datum

      var {resource_id} = req.params
      var {user_datum} = this.get('models')

      user_datum.destroy({
        where: {
          owner_id: req.user.id,
          id: resource_id
        }
      }).then(function(destroyed) {
        if (destroyed) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'user_datum record archived',
            body: null
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
    }
  },

  // 5 GET /profile/:user_id
  {
    uri: '/profile/:user_id',
    method: 'get',
    secure: false,
    active: false,
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
                id: found.id,
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