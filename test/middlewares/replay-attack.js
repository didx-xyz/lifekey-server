
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')
var subject = require('../../src/middlewares/replay-attack')

var now = Date.now()

describe('middleware replay-attack', function() {
  
  it('should invoke the success callback if the request is skippable', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: true
    }, done.bind(
      done, new Error('should not have been called')
    ), done)
  })

  it('should invoke the success callback if the signature was logged to database', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: false,
      headers: {
        'x-cnsnt-signable': now,
        'x-cnsnt-signed': now
      },
      user: {
        crypto: {
          public_key: Buffer.from('foo'),
          algorithm: 'foo'
        }
      }
    }, done.bind(
      done, new Error('should not have been called')
    ), done)
  })

  it('should respond with error if a known signature is detected', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: false,
      headers: {
        'x-cnsnt-signable': now,
        'x-cnsnt-signed': now
      },
      user: {
        crypto: {
          public_key: Buffer.from('foo'),
          algorithm: 'foo'
        }
      }
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('detected a known signature')
      done()
    }), done.bind(
      done, new Error('should not have been called')
    ))
  })

})
