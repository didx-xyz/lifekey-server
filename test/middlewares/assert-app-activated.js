
'use strict'

var crypto = require('crypto')

var {expect} = require('chai')

var mock = require('../mock/express')
var subject = require('../../src/middlewares/assert-app-activated')

describe('middleware assert-app-activated', function() {

  it('should invoke the success callback if the request is not activated-only and secured-only', function(done) {
    subject.call(mock.express, {
      skip_active_checks: true,
      skip_secure_checks: false,
      user: {app_activation_link_clicked: false}
    }, mock.res(function(res) {
      return done(new Error('should not have been called'))
    }), done)
  })
  
  it('should invoke the success callback if the request is activated-only and secured-only and user is activated', function(done) {
    subject.call(mock.express, {
      skip_active_checks: false,
      skip_secure_checks: false,
      user: {app_activation_link_clicked: true}
    }, mock.res(function(res) {
      return done(new Error('should not have been called'))
    }), done)
  })

  it('should invoke the success callback if the request is activated-only and not secured-only and user is activated', function(done) {
    subject.call(mock.express, {
      skip_active_checks: false,
      skip_secure_checks: true,
      user: {app_activation_link_clicked: true}
    }, mock.res(function(res) {
      return done(new Error('should not have been called'))
    }), done)
  })

  it('should respond with error if the activation link has not been clicked', function(done) {
    subject.call(mock.express, {
      skip_active_checks: false,
      skip_secure_checks: true,
      user: {app_activation_link_clicked: false}
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('app not yet activated')
      done()
    }), done.bind(done, new Error('should not have been called')))
  })
})
