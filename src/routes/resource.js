
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
      var errors = this.get('db_errors')
      if (pushed) {
        db.query([
          'SELECT id, entity, attribute, alias',
          'FROM user_data',
          'WHERE owner_id = :owner_id AND',
          'from_user_did IS NOT NULL',
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
      } else {
        db.query([
          'SELECT id, entity, attribute, alias',
          'FROM user_data',
          'WHERE owner_id = :owner_id AND',
          'from_user_did IS NULL',
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
      var errors = this.get('db_errors')

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
        is_verifiable_claim,
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
      var errors = this.get('db_errors')

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
          is_verifiable_claim: is_verifiable_claim,
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

  // 3 PUT /resource/:resource_id
  {
    uri: '/resource/:resource_id',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      
      var {resource_id} = req.params
      var {user_datum} = this.get('models')
      var errors = this.get('db_errors')

      var {
        entity, attribute, alias,
        schema, uri, encoding,
        mime, value, is_default,
        is_verifiable_claim,
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
      if (typeof is_verifiable_claim !== 'undefined') updatefields.is_verifiable_claim = is_verifiable_claim
      if (typeof is_archived !== 'undefined') updatefields.is_archived = is_archived
      
      return user_datum.update(updatefields, {
        where: {
          owner_id: req.user.id,
          id: resource_id
        }
      }).then(function(updated) {
        if (updated[0] > 0) {
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
      var errors = this.get('db_errors')

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

  // 5 GET /profile/:user_did
  {
    uri: '/profile/:user_did',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {user_did} = req.params
      var {user} = this.get('models')
      user.findOne({
        where: {did: user_did}
      }).then(function(found) {
        if (found) {
          return res.status(200).json({
            error: false,
            status: 200,
            message: 'ok',
            body: {
              user: {
                colour: found.branding_colour_code,
                image_uri: found.branding_image_uri,
                actions_url: found.actions_url,
                display_name: found.display_name,
                address: found.contact_address,
                tel: found.contact_tel,
                email: found.contact_email,
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
  },

  // 6 PUT /profile/colour
  {
    uri: '/profile/colour',
    method: 'put',
    secure: true,
    active: false,
    callback: function(req, res) {
      var {user} = this.get('models')
      var errors = this.get('db_errors')
      var {colour} = req.body
      var hex_colour = /^#(?:[0-9a-f]{3}){1,2}$/i
      if (!hex_colour.test(colour)) {
        return res.status(400).json({
          error: true,
          status: 400,
          message: 'invalid hex colour code given',
          body: null
        })
      }
      user.update(
        {branding_colour_code: colour},
        {where: {id: req.user.id}}
      ).then(function(updated) {
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
  },

  // 7 PUT /profile/image
  {
    uri: '/profile/image',
    method: 'put',
    secure: true,
    active: false,
    callback: function(req, res) {
      var {user} = this.get('models')
      var errors = this.get('db_errors')
      var {image_uri} = req.body
      user.update(
        {branding_image_uri: image_uri},
        {where: {id: req.user.id}}
      ).then(function(updated) {
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
  },

  // 8 PUT /profile/name
  {
    uri: '/profile/name',
    method: 'put',
    secure: true,
    active: false,
    callback: function(req, res) {
      var {user} = this.get('models')
      var errors = this.get('db_errors')
      var {name} = req.body
      user.update(
        {display_name: name},
        {where: {id: req.user.id}}
      ).then(function(updated) {
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
  },

  // 9 PUT /profile/email
  {
    uri: '/profile/email',
    method: 'put',
    secure: true,
    active: false,
    callback: function(req, res) {
      var {user} = this.get('models')
      var errors = this.get('db_errors')
      var {email} = req.body
      user.update(
        {contact_email: email},
        {where: {id: req.user.id}}
      ).then(function(updated) {
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
  },

  // 10 PUT /profile/tel
  {
    uri: '/profile/tel',
    method: 'put',
    secure: true,
    active: false,
    callback: function(req, res) {
      var {user} = this.get('models')
      var errors = this.get('db_errors')
      var {tel} = req.body
      user.update(
        {contact_tel: tel},
        {where: {id: req.user.id}}
      ).then(function(updated) {
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
  },

  // 11 PUT /profile/address
  {
    uri: '/profile/address',
    method: 'put',
    secure: true,
    active: false,
    callback: function(req, res) {
      var {user} = this.get('models')
      var errors = this.get('db_errors')
      var {address} = req.body
      user.update(
        {contact_address: address},
        {where: {id: req.user.id}}
      ).then(function(updated) {
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
  },

  // 12 GET /profile
  {
    uri: '/profile',
    method: 'get',
    secure: true,
    active: false,
    callback: function(req, res) {
      return res.status(200).json({
        error: false,
        status: 200,
        message: 'ok',
        body: {
          colour: req.user.branding_colour_code,
          image_uri: req.user.branding_image_uri,
          actions_url: req.user.actions_url,
          display_name: req.user.display_name,
          address: req.user.contact_address,
          tel: req.user.contact_tel,
          email: req.user.contact_email,
          did: req.user.did,
          did_address: req.user.did_address
        }
      })
    }
  }
]