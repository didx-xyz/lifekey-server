
'use strict'

var crypto = require('crypto')

var ec = require('eccrypto')
var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var subject = require('../../src/middlewares/ensure-required-headers-present')

before(function(done) {
  done(new Error('not implemented'))
})

describe('middleware ensure-required-headers-present', function() {
  it('should respond with error if required headers are missing', function(done) {
    done(new Error('not implemented'))
  })
  it('should invoke the success callback if required headers are present', function(done) {
    done(new Error('not implemented'))
  })
})