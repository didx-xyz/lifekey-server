
'use strict'

var http = require('http')
var crypto = require('crypto')

var secp = require('secp256k1')

var {expect} = require('chai')

var mock = require('../mock/express')

var routes = require('../../src/routes/root')
var web_auth = routes[3]

var test_user
var user_without_eis_key

var test_server_ready
var test_server = http.createServer(function(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(400)
  } else if (req.url === '/pass') {
    res.writeHead(200)
  } else if (req.url === '/fail') {
    res.writeHead(400)
  } else {
    res.writeHead(500)
  }
  return res.end()
}).listen(8999, function() {
  test_server_ready = true
})

function wait(cond, end) {
  if (cond()) return end()
  setImmediate(wait.bind(wait, cond, end))
}

describe('root', function() {
  
  before(function(done) {
    // create a test user with an eis key
    require('../../src/init/database')(
      false
    ).then(function(database) {
      mock.express.set('models', database.models)
      mock.express.set('db', database.db)
      var now = `_u1_${Date.now()}`
      return Promise.all([
        database.models.user.create({
          did: now,
          nickname: now,
          email: `${now}@example.com`,
          app_activation_code: now,
          app_activation_link_clicked: true
        }),
        database.models.user.create({
          did: now + 2,
          nickname: now + 2,
          email: `${now}2@example.com`,
          app_activation_code: now + 2,
          app_activation_link_clicked: true
        })
      ])
    }).then(function(created) {
      if (created[0] && created[1]) {
        test_user = created[0]
        user_without_eis_key = created[1]
        return Promise.resolve()
      }
      return done(new Error('should not have been called'))
    }).then(function() {
      do {
        var private_key = crypto.rng(32)
      } while (!secp.privateKeyVerify(private_key))
      return mock.express.get('models').crypto_key.create({
        owner_id: test_user.id,
        algorithm: 'secp256k1',
        purpose: 'foo',
        alias: 'eis',
        private_key: private_key,
        public_key: secp.publicKeyCreate(private_key)
      })
    }).then(function(created) {
      if (created) return Promise.resolve()
      return done(new Error('should not have been called'))
    }).then(function() {
      wait(function() {
        return !!test_server_ready
      }, done)
    }).catch(done)
  })

  after(function(done) {
    if (test_server) return test_server.close(done)
    done()
  })

  describe.only(`${web_auth.method.toUpperCase()} ${web_auth.uri}`, function() {
    
    it('should fail if missing required arguments', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        expect(res.body).to.equal(null)
        done()
      }))
    })
    
    it('should fail if url throws a type error', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {
          auth_callback: 123,
          nonce: 'foo',
          session_id: 'bar'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('url not given for auth_callback')
        expect(res.body).to.equal(null)
        done()
      }))
    })

    it('should fail if the url was parseable but no hostname was derived', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {
          auth_callback: 'foo',
          nonce: 'foo',
          session_id: 'bar'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('could not determine hostname from given url')
        expect(res.body).to.equal(null)
        done()
      }))
    })
    
    it('should fail if the user has no eis key', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: user_without_eis_key.id},
        body: {
          auth_callback: 'http://localhost:8999/pass',
          nonce: 'foo',
          session_id: 'bar'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(500)
        expect(res.message).to.equal('user has no eis key')
        expect(res.body).to.equal(null)
        done()
      }))
    })
    
    it('should fail if the remote service returned a non-200 status code', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {
          auth_callback: 'http://localhost:8999/fail',
          nonce: 'foo',
          session_id: 'bar'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(403)
        expect(res.message).to.equal('remote service denied access')
        expect(res.body).to.equal(null)
        done()
      }))
    })
    
    it.skip('should fail if a network transport error occurred', function(done) {
      // maybe temporarily bring down the main network interface to run this test?
    })
    
    it('should return ok if all error-checks pass', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: test_user.id},
        body: {
          auth_callback: 'http://localhost:8999/pass',
          nonce: 'foo',
          session_id: 'bar'
        }
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