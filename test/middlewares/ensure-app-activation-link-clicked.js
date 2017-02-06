
'use strict'

var crypto = require('crypto')

var ec = require('eccrypto')
var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var subject = require('../../src/middlewares/ensure-app-activation-link-clicked')

before(function(done) {
  done(new Error('not implemented'))
})

describe('middleware ensure-app-activation-link-clicked', function() {
  it('should respond with not found if the activation link has not been clicked', function(done) {
    done(new Error('not implemented'))
  })
  it('should invoke the success callback if the activation link has been clicked', function(done) {
    done(new Error('not implemented'))
  })
})