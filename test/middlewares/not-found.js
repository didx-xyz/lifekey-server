
'use strict'

var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var subject = require('../../src/middlewares/not-found')

describe.skip('middleware not-found', function() {
  it('should respond with 404', function(done) {
    done(new Error('not implemented'))
  })
  it('should not invoke the success callback', function(done) {
    done(new Error('not implemented'))
  })
})