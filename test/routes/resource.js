
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')

var routes = require('../../src/routes/resource')

var eaa_create = routes[4]
var eaa_fetch = routes[3]
var eaa_update = routes[5]
var eaa_remove = routes[6]
var ea_fetch = routes[2]
var e_fetch = routes[1]
var fetch = routes[0]

var now1 = `_u1_${Date.now()}`, now2 = `_u2_${Date.now()}`, now3 = `_u3_${Date.now()}`
var test_user1, test_user2, test_user3

function very_bad_id_creator() {
  return Math.round(
    (Date.now() - (Math.random() * 1000000000000)) / 4096
  )
}

before(function(done) {
  var isa_id
  require('../../src/init/database')(
    false
  ).then(function(database) {
    mock.express.set('models', database.models)
    mock.express.set('db', database.db)
    return database.models.user.create({
      did: now1,
      nickname: now1,
      email: `${now1}@example.com`,
      app_activation_code: now1,
      app_activation_link_clicked: true
    })
  }).then(function(created) {
    if (created) {
      test_user1 = created
      var {user} = mock.express.get('models')
      return user.create({
        did: now2,
        nickname: now2,
        email: `${now2}@example.com`,
        app_activation_code: now2,
        app_activation_link_clicked: true
      })
    }
    return done(new Error('should not have been called'))
  }).then(function(created) {
    if (created) {
      test_user2 = created
      return Promise.resolve()
    }
    return done(new Error('should not have been called'))
  }).then(function() {
    var {information_sharing_agreement} = mock.express.get('models')
    return information_sharing_agreement.create({
      isar_id: very_bad_id_creator(),
      from_id: test_user2.id,
      from_did: test_user2.did,
      to_id: test_user1.id,
      to_did: test_user1.did
    })
  }).then(function(created) {
    if (created) {
      isa_id = created.id
      return Promise.resolve()
    }
    return done(new Error('should not have been called'))
  }).then(function() {
    var {information_sharing_permission} = mock.express.get('models')
    return information_sharing_permission.create({
      isa_id: isa_id,
      resource_uri: '/resource/foo/bar/baz'
    })
  }).then(function(created) {
    if (created) {
      var {information_sharing_permission} = mock.express.get('models')
      return information_sharing_permission.create({
        isa_id: isa_id,
        resource_uri: '/resource/foo/bar/qux'
      })
    }
    return done(new Error('should not have been called'))
  }).then(function(created) {
    if (created) return Promise.resolve()
    return done(new Error('should not have been called'))
  }).then(function() {
    var {user} = mock.express.get('models')
    return user.create({
      did: now3,
      nickname: now3,
      email: `${now3}@example.com`,
      app_activation_code: now3,
      app_activation_link_clicked: true
    })
  }).then(function(created) {
    if (created) {
      test_user3 = created
      return done()
    }
    return done(new Error('should not have been called'))
  }).catch(done)
})

describe('resource', function() {
  // in this order...

  // 4 POST /resource/:entity/:attribute/:alias
  describe(`${eaa_create.method.toUpperCase()} ${eaa_create.uri}`, function() {
    
    it('should respond with an error if required arguments are missing', function(done) {
      eaa_create.callback.call(mock.express, {
        body: {},
        user: {id: test_user1.id, did: test_user1.did},
        params: {
          entity: 'foo',
          attribute: 'bar',
          alias: 'baz'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        done()
      }))
    })

    it('should create the resource using the given arguments without error', function(done) {
      eaa_create.callback.call(mock.express, {
        body: {value: 'qux'},
        user: {id: test_user1.id, did: test_user1.did},
        params: {
          entity: 'foo',
          attribute: 'bar',
          alias: 'baz'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('created')
        expect(res.body).to.equal(`/resource/foo/bar/baz`)
        done()
      }))
    })

    it('should respond with an error if a resource would be overwritten', function(done) {
      eaa_create.callback.call(mock.express, {
        body: {value: 'qux'},
        user: {id: test_user1.id, did: test_user1.did},
        params: {
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

  // 3 GET /resource/:entity/:attribute/:alias
  describe(`${eaa_fetch.method.toUpperCase()} ${eaa_fetch.uri}`, function() {

    it('should return the requested resource if found and requested by the owner', function(done) {
      eaa_fetch.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'baz'},
        query: {owner: false}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body.value.toString()).to.equal('qux')
        done()
      }))
    })

    it('should respond with an error if the requested resource does not exist', function(done) {
      eaa_fetch.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'qux'},
        query: {owner: false}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_datum record not found')
        done()
      }))
    })
    
    it('should respond with an error if the requested resource belongs to another user and the calling agent does not have an information_sharing_agreement with that user', function(done) {
      eaa_fetch.callback.call(mock.express, {
        user: {id: test_user3.id, did: test_user3.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'baz'},
        query: {owner: ''+test_user1.id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record(s) not found')
        done()
      }))
    })
    
    it('should respond with an error if the calling agent is not permitted to access the specified resource or the specified resource does not exist', function(done) {
      eaa_fetch.callback.call(mock.express, {
        user: {id: test_user2.id, did: test_user2.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'foobarbazqux'},
        query: {owner: ''+test_user1.id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('not permitted to access the requested resource')
        done()
      }))
    })

    it('should respond with the requested resource if the calling agent is permitted to view it', function(done) {
      eaa_fetch.callback.call(mock.express, {
        user: {id: test_user2.id, did: test_user2.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'baz'},
        query: {owner: ''+test_user1.id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body.value.toString()).to.equal('qux')
        done()
      }))
    })
  })

  // 5 PUT /resource/:entity/:attribute/:alias
  describe(`${eaa_update.method.toUpperCase()} ${eaa_update.uri}`, function() {

    it('should respond with an error if the record does not exist', function(done) {
      eaa_update.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'foobarbazqux'},
        body: {is_default: true}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_datum record not found')
        done()
      }))
    })
    
    it('should update the specified record if it exists', function(done) {
      eaa_fetch.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'baz'},
        query: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body.value.toString()).to.equal('qux')
        expect(res.body.is_default).to.equal(false)

        eaa_update.callback.call(mock.express, {
          user: {id: test_user1.id, did: test_user1.did},
          params: {entity: 'foo', attribute: 'bar', alias: 'baz'},
          body: {is_default: true}
        }, mock.res(function(res) {
          expect(res.error).to.equal(false)
          expect(res.status).to.equal(200)
          expect(res.message).to.equal('user_datum record updated')
          expect(res.body.is_default).to.equal(true)
          done()
        }))
      }))
    })
    
  })

  // 6 DELETE /resource/:entity/:attribute/:alias
  describe(`${eaa_remove.method.toUpperCase()} ${eaa_remove.uri}`, function() {
    it('should respond with an error if the record does not exist', function(done) {
      eaa_remove.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'foobarbazqux'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_datum record not found')
        done()
      }))
    })

    it('should archive the record if it exists', function(done) {
      eaa_remove.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo', attribute: 'bar', alias: 'baz'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('user_datum record archived')
        done()
      }))
    })
  })

  // 2 GET /resource/:entity/:attribute
  describe(`${ea_fetch.method.toUpperCase()} ${ea_fetch.uri}`, function() {
    it('should respond with a list of aliases namespaced under the specified entity and attribute owned by the specified user', function(done) {
      ea_fetch.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo', attribute: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body).to.have.members(['baz'])
        done()
      }))
    })
  })

  // 1 GET /resource/:entity
  describe(`${e_fetch.method.toUpperCase()} ${e_fetch.uri}`, function() {
    it('should respond with a list of attributes namespaced under the specified entity owned by the specified user', function(done) {
      e_fetch.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did},
        params: {entity: 'foo'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body).to.have.members(['bar'])
        done()
      }))
    })
  })
  
  // 0 GET /resource
  describe(`${fetch.method.toUpperCase()} ${fetch.uri}`, function() {
    it('should respond with a list of entities owned by the specified user', function(done) {
      fetch.callback.call(mock.express, {
        user: {id: test_user1.id, did: test_user1.did}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body).to.have.members(['foo'])
        done()
      }))
    })
  })
})