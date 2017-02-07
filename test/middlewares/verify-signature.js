
'use strict'

var crypto = require('crypto')

var ec = require('eccrypto')
var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var subject = require('../../src/middlewares/verify-signature')

before(function(done) {
  // TODO create fixtures for each test case
  done(new Error('not implemented'))
})

describe('middleware verify-signature', function() {
  it('should invoke the success callback if the matched route is not secured', function(done) {
    done(new Error('not implemented'))
  })
  
  it('should respond with bad request if non-hexadecimal headers are given', function(done) {
    done(new Error('not implemented'))
  })

  it('should respond with bad request if non-utf8 header is given', function(done) {
    done(new Error('not implemented'))
  })

  it('should respond with an error if the signature verification fails', function(done) {
    done(new Error('not implemented'))
  })
  
  it('should invoke the success callback if signature verification succeeds', function(done) {
    done(new Error('not implemented'))
  })
})