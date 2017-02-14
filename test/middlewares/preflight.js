
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')
var subject = require('../../src/middlewares/preflight')

before(function(done) {
  mock.express.set('secure_foo_foo', false)
  mock.express.set('active_foo_foo', false)
  mock.express.set('secure_foo_baz', true)
  mock.express.set('active_foo_baz', true)
  done()
})

describe('middleware preflight', function() {
  it('should invoke the success callback if the request is flagged as skippable', function(done) {
    subject.call(mock.express, {
      method: 'FOO',
      route: {path: 'foo'},
    }, mock.res(function(res) {
      return done(new Error('should not be called'))
    }), done)
  })

  it('should invoke the next middleware if the request is not skippable', function(done) {
    subject.call(mock.express, {
      method: 'FOO',
      route: {path: 'baz'},
    }, mock.res(function(res) {
      return done(new Error('should not be called'))
    }), done)
  })
})
