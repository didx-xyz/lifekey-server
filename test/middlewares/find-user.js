
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')
var subject = require('../../src/middlewares/find-user')

var now = Date.now()
var test_user, test_user_key, test_user_fingerprint_key

before(function(done) {
  this.timeout(20000) // it takes a while to load these models

  var user, crypto_key
  
  require('../../src/init/database')(
    false // disable sql logging
  ).then(function(database) {
    mock.express.models = database.models
    mock.express.db_errors = database.errors
    user = database.models.user
    crypto_key = database.models.crypto_key
    return user.create({
      did: `${now}_foo`,
      nickname: `${now}_foo`,
      email: `${now}_foo@bar.baz`,
      webhook_url: `${now}_foo`,
      app_activation_code: `${now}_foo`,
      app_activation_link_clicked: true
    })
  }).then(function(created) {
    if (created) {
      test_user = created
      return crypto_key.create({
        owner_id: created.id,
        algorithm: 'foo',
        purpose: 'foo',
        alias: 'client-server-http',
        private_key: Buffer.from('foo'),
        public_key: Buffer.from('foo')
      })
    }
    return done(new Error('should not have been called'))
  }).then(function(created) {
    if (created) {
      test_user_key = created
      return crypto_key.create({
        owner_id: test_user.id,
        algorithm: 'foo',
        purpose: 'foo',
        alias: 'fingerprint',
        private_key: Buffer.from('foo'),
        public_key: Buffer.from('foo')
      })
      return done()
    }
    return done(new Error('should not have been called'))
  }).then(function(created) {
    if (created) {
      test_user_fingerprint_key = created
      return done()
    }
    return done(new Error('should not have been called'))
  }).catch(done)
})

describe('middleware find-user', function() {
  
  it('should respond with error if required headers are missing', function(done) {
    subject.call(mock.express, {
      headers: {}
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('authentication parameters missing from request headers')
      done()
    }), done.bind(done, new Error('should not be called')))
  })

  it('should respond with error if given id corresponds to user that does not exist', function(done) {
    subject.call(mock.express, {
      headers: {
        'x-cnsnt-id': 'foo',
        'x-cnsnt-did': 'bar',
        'x-cnsnt-plain': 'foo',
        'x-cnsnt-signed': 'foo'
      }
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(404)
      expect(res.message).to.equal('user record not found')
      done()
    }), done.bind(done, new Error('should not be called')))
  })

  it('should invoke the success callback if specified user exists (no fingerprint key)', function(done) {
    subject.call(mock.express, {
      headers: {
        'x-cnsnt-id': test_user.id,
        'x-cnsnt-did': test_user.did,
        'x-cnsnt-plain': 'foo',
        'x-cnsnt-signed': 'foo'
      }
    }, mock.res(function(res) {
      done(new Error('should not be called'))
    }), done)
  })

  it('should invoke the success callback if specified user exists (fingerprint key)', function(done) {
    subject.call(mock.express, {
      headers: {
        'x-cnsnt-id': test_user.id,
        'x-cnsnt-did': test_user.did,
        'x-cnsnt-plain': 'foo',
        'x-cnsnt-signed': 'foo',
        'x-cnsnt-fingerprint': 'foo'
      }
    }, mock.res(function(res) {
      done(new Error('should not be called'))
    }), done)
  })
})