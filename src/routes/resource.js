
module.exports = [
  {
    uri: '/resource',
    method: 'get',
    callback: function(req, res) {
      // ensure calling agent is authorised
      // --
      // list all entities
    }
  },
  {
    uri: '/resource/:entity',
    method: 'get',
    callback: function(req, res) {
      // ensure calling agent is authorised
      // --
      // list all attributes or list entire entity and attributes
    }
  },
  {
    uri: '/resource/:entity/:attribute',
    method: 'get',
    callback: function(req, res) {
      // ensure calling agent is authorised
      // --
      // return attribute
    }
  },
  {
    uri: '/resource',
    method: 'post',
    callback: function(req, res) {
      // create an entity
    }
  },
  {
    uri: '/resource/:entity',
    method: 'post',
    callback: function(req, res) {
      // create an attribute
    }
  },
  {
    uri: '/resource/:entity',
    method: 'put',
    callback: function(req, res) {
      // update an entity
    }
  },
  {
    uri: '/resource/:entity/:attribute',
    method: 'put',
    callback: function(req, res) {
      // update an attribute
    }
  },
  {
    uri: '/resource/:entity',
    method: 'delete',
    callback: function(req, res) {
      // remove an entity
    }
  },
  {
    uri: '/resource/:entity/:attribute',
    method: 'delete',
    callback: function(req, res) {
      // remove an attribute
    }
  }
]