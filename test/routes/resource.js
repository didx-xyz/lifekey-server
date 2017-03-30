
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')

var routes = require('../../src/routes/resource')

var resource_index = routes[0]
var resource_get_one  = routes[1]
var resource_create = routes[2]
var resource_update = routes[3]
var resource_delete = routes[4]

var profile_colour_update = routes[6]
var profile_image_update = routes[7]

describe('resource', function() {
  
  var test_user

  before(function(done) {
    require('../../src/init/database')(
      false
    ).then(function(database) {
      mock.express.set('models', database.models)
      mock.express.set('db', database.db)
      var now = `_u1_${Date.now()}`
      return database.models.user.create({
        did: now,
        nickname: now,
        email: `${now}@example.com`,
        app_activation_code: now,
        app_activation_link_clicked: true
      })
    }).then(function(created) {
      if (!created) {
        return done(
          new Error('should not have been called')
        )
      }
      test_user = created
      done()
    }).catch(done)
  })

  // 4 POST /resource
  describe(`${resource_create.method.toUpperCase()} ${resource_create.uri}`, function() {
    
    it('should respond with an error if required arguments are missing', function(done) {
      resource_create.callback.call(mock.express, {
        body: {
          // entity: 'foo',
          // attribute: 'bar',
          // alias: 'baz'
        },
        user: {id: test_user.id, did: test_user.did}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        done()
      }))
    })

    it('should create the resource using the given arguments without error', function(done) {
      resource_create.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        body: {
          value: 'qux',
          entity: 'foo',
          attribute: 'bar',
          alias: 'baz',
          is_verifiable_claim: true
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('created')
        expect(!!res.body).to.equal(true)
        done()
      }))
    })

    it('should respond with an error if a resource would be overwritten', function(done) {
      resource_create.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        body: {
          value: 'qux',
          entity: 'foo',
          attribute: 'bar',
          alias: 'baz'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('resource with alias baz already exists')
        done()
      }))
    })
  })

  // 3 GET /resource/:resource_id
  describe(`${resource_get_one.method.toUpperCase()} ${resource_get_one.uri}`, function() {

    var created_id
    before(function(done) {
      resource_create.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        body: {
          value: 'qux',
          entity: 'foo',
          attribute: 'bar',
          alias: `baz_${Date.now()}`
        }
      }, mock.res(function(res) {
        created_id = res.body.id
        done(res.body.error || null)
      }))
    })

    it('should return the requested resource if found and requested by the owner', function(done) {
      resource_get_one.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        params: {resource_id: created_id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body.value.toString()).to.equal('qux')
        done()
      }))
    })

    it('should respond with an error if the requested resource does not exist', function(done) {
      resource_get_one.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        params: {resource_id: Number.MAX_VALUE}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_datum record not found')
        done()
      }))
    })
  })

  // 5 PUT /resource/:resource_id
  describe(`${resource_update.method.toUpperCase()} ${resource_update.uri}`, function() {

    var created_id
    before(function(done) {
      resource_create.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        body: {
          value: 'qux',
          entity: 'foo',
          attribute: 'bar',
          alias: `baz_${Date.now()}`
        }
      }, mock.res(function(res) {
        created_id = res.body.id
        done(res.body.error || null)
      }))
    })

    it('should respond with an error if the record does not exist', function(done) {
      resource_update.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        params: {resource_id: Number.MAX_VALUE},
        body: {is_default: true}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_datum record not found')
        done()
      }))
    })
    
    it('should update the specified record if it exists', function(done) {
      resource_update.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        params: {resource_id: created_id},
        body: {is_default: true}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('user_datum record updated')
        done()
      }))
    })
    
  })

  // 6 DELETE /resource/:resource_id
  describe(`${resource_delete.method.toUpperCase()} ${resource_delete.uri}`, function() {

    var created_id
    before(function(done) {
      resource_create.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        body: {
          value: 'qux',
          entity: 'foo',
          attribute: 'bar',
          alias: `baz_${Date.now()}`
        }
      }, mock.res(function(res) {
        created_id = res.body.id
        done(res.body.error || null)
      }))
    })

    it('should respond with an error if the record does not exist', function(done) {
      resource_delete.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        params: {resource_id: Number.MAX_VALUE}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_datum record not found')
        done()
      }))
    })

    it('should archive the record if it exists', function(done) {
      resource_delete.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        params: {resource_id: created_id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('user_datum record archived')
        done()
      }))
    })
  })

  // 0 GET /resource
  describe(`${resource_index.method.toUpperCase()} ${resource_index.uri}`, function() {
    it('should respond with an array of [entity, attribute, alias] values if not using query option', function(done) {
      resource_index.callback.call(mock.express, {
        user: {id: test_user.id, did: test_user.did},
        query: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body.length).to.equal(4)
        done()
      }))
    })
  })

  describe(`${profile_colour_update.method.toUpperCase()} ${profile_colour_update.uri}`, function() {
    it('should not allow the update of the colour field if non hex colour code given', function(done) {
      profile_colour_update.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {colour: 'foo'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('invalid hex colour code given')
        expect(res.body).to.equal(null)
        done()
      }))
      
    })
    it('should allow the update of the colour field', function(done) {
      profile_colour_update.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {colour: '#f00'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body).to.equal(null)
        done()
      }))
    })
  })

  describe(`${profile_image_update.method.toUpperCase()} ${profile_image_update.uri}`, function() {
    it('should allow the update of the image field', function(done) {
      profile_image_update.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {image_uri: 'foo'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body).to.equal(null)
        done()
      }))
    })
  })
})