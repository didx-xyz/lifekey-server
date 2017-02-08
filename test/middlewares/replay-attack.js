
'use strict'

var crypto = require('crypto')

var ec = require('eccrypto')
var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var subject = require('../../src/middlewares/replay-attack')

describe.skip('replay attack', function() {
  before(function(done) {
    // TODO create fixtures for each test case
    done(new Error('not implemented'))
  })

  describe('middleware replay-attack', function() {
    
    it('should respond with not found if unable to find the specified user record', function(done) {
      done(new Error('not implemented'))
    })

    it('should respond with not found if unable to to find the specified crypto_key record', function(done) {
      done(new Error('not implemented'))
    })

    it('should respond with error if a known signature is detected', function(done) {
      done(new Error('not implemented'))
    })

    it('should invoke the success callback if the signature was logged to database', function(done) {
      done(new Error('not implemented'))
    })
  })
})
