
'use strict'

// TODO query string parameters (limit,offset, etc)

// TODO parse permissions in ISA docs associated with owner and caller on the fly

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
      // return value associated with entity/attribute/alias
    }
  },
  {
    uri: '/resource',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // create an entity
    }
  },
  {
    uri: '/resource/:entity',
    method: 'post',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // create an attribute
    }
  },
  {
    uri: '/resource/:entity',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // update an entity
    }
  },
  {
    uri: '/resource/:entity/:attribute',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // update an attribute
    }
  },
  {
    uri: '/resource/:entity/:attribute/:alias',
    method: 'put',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // update an alias
    }
  },
  {
    uri: '/resource/:entity',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // remove an entity
    }
  },
  {
    uri: '/resource/:entity/:attribute',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // remove an attribute
    }
  },
  {
    uri: '/resource/:entity/:attribute/:alias',
    method: 'delete',
    secure: true,
    active: true,
    callback: function(req, res) {
      // OWNER ONLY
      // remove an aliased attribute
    }
  }
]