
'use strict'

// TODO query string parameters (limit,offset, etc)
// TODO call webhooks for all permitted parties when data changes (PUT)

module.exports = [
  {
    uri: '/resource',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // list all entities
    }
  },
  {
    uri: '/resource/:entity',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // list all attributes
    }
  },
  {
    uri: '/resource/:entity/:attribute',
    method: 'get',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // list all aliases
    }
  },
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

      if (owner !== '') {
        // access by other user
        return information_sharing_agreement.findAll({where: {
          $and: [
            {
              $or: [
                {to_id: owner},
                {to_did: owner}
              ]
            },
            {
              $or: [
                {from_id: req.user.id},
                {from_did: req.user.did}
              ]
            }
          ]}
        }).then(function(found) {
          if (found) {
            return Promise.all(
              found.map(function(isa) {
                return information_sharing_permission.findAll({
                  where: {information_sharing_agreement_id: isa.id}
                })
              })
            )
          }
          return Promise.reject({
            error: true,
            status: 404,
            message: 'information_sharing_agreement records not found',
            body: null
          })
        }).then(function(found) {
          if (found) {
            for (var i = 0, len = found.length; i < len; i++) {
              if (found[i].resource_uri ===
                  `/resource/${entity}/${attribute}/${alias}`) {
                return Promise.resolve()
              }
            }
            return Promise.reject({
              error: true,
              status: 400,
              message: 'not permitted to access the requested resource',
              body: null
            })
          }
          return Promise.reject({
            error: true,
            status: 404,
            message: 'information_sharing_permission records not found',
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
              body: found
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

      // access from the owner
      user_datum.findOne({
        where: {
          owner_id: req.user.id,
          entity: entity,
          attribute: attribute,
          alias: alias
        }
      }).then(function(found) {
        if (found) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
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
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'user_datum record updated',
            body: null
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
  {
    uri: '/resource/:entity/:attribute/:alias',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // remove an aliased datum
    }
  }
]