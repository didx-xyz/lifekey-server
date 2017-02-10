
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')
var subject = require('../../src/middlewares/assert-headers')

before(function(done) {
  mock.express.set('secure_foo_foo', false)
  mock.express.set('active_foo_foo', false)
  mock.express.set('secure_foo_baz', true)
  mock.express.set('active_foo_baz', true)
  done()
})

describe('middleware assert-headers', function() {

  it('should invoke the success callback if request is skippable', function(done) {
    subject.call(mock.express, {
      method: 'FOO',
      route: {path: 'foo'}
    }, done.bind(
      done, new Error('should not be called')
    ), done)
  })

  it('should respond with error if required headers are missing', function(done) {
    subject.call(mock.express, {
      method: 'FOO',
      route: {path: 'baz'},
      headers: {}
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('authentication parameters missing from request headers')
      done()
    }), done.bind(
      done, new Error('should not be called')
    ))
  })
  
  it('should invoke the success callback if required headers are present', function(done) {
    subject.call(mock.express, {
      method: 'FOO',
      route: {path: 'baz'},
      headers: {
        'x-cnsnt-id': 'foo',
        'x-cnsnt-plain': 'foo',
        'x-cnsnt-signable': 'foo',
        'x-cnsnt-signed': 'foo'
      }
    }, done.bind(
      done, new Error('should not be called')
    ), function() {
      subject.call(mock.express, {
        method: 'FOO',
        route: {path: 'baz'},
        headers: {
          'x-cnsnt-did': 'foo',
          'x-cnsnt-plain': 'foo',
          'x-cnsnt-signable': 'foo',
          'x-cnsnt-signed': 'foo'
        }
      }, done.bind(
        done, new Error('should not be called')
      ), done)
    })
  })
})