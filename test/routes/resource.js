
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')

var routes = require('../../src/routes/resource')

before(function(done) {
  require('../../src/init/database')(
    false
  ).then(function(database) {
    mock.express.set('models', database.models)
    mock.express.set('db', database.db)
    done()
  })
})

describe('resource', function() {
  // in this order...
  // 4 POST /resource/:entity/:attribute/:alias
  // 3 GET /resource/:entity/:attribute/:alias
  // 5 PUT /resource/:entity/:attribute/:alias
  // 6 DELETE /resource/:entity/:attribute/:alias
  // 2 GET /resource/:entity/:attribute
  // 1 GET /resource/:entity
  // 0 GET /resource
})