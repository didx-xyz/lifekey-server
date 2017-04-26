
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')

var routes = require('../../src/routes/directory')

var ping = routes[1]
var list = routes[0]

describe('directory', function() {
  
  var created_user_id

  before(function(done) {
    // initialising the models takes ages :/
    this.timeout(30000)
    require('../../src/init/database')(
      false // disable sql logging
    ).then(function(database) {
      mock.express.set('env', {
        _: process.env._,
        SERVER_HOSTNAME: 'localhost'
      })
      mock.express.set('models', database.models)
      mock.express.set('db_errors', database.errors)
      console.log('✓ initialised database models')
      return Promise.resolve()
    }).then(function() {
      var foo = Date.now() + '_foo'
      return mock.express.models.user.create({
        did: foo,
        nickname: foo,
        email: foo + '@example.com',
        webhook_url: foo + '.example.com',
        actions_url: foo + '.example.com/actions',
        display_name: foo,
        app_activation_code: foo,
        app_activation_link_clicked: true
      })
    }).then(function(created) {
      if (!created) return done(new Error('should not have been called'))
      created_user_id = created.id
      var ages_ago = new Date
      ages_ago.setFullYear(1999)
      return mock.express.models.active_bot.create({
        owner_id: created_user_id,
        last_ping: ages_ago
      })
    }).then(
      done.bind(done, null)
    ).catch(done)
  })

  after(function(done) {
    mock.express.models.active_bot.destroy({
      where: {id: {gt: 0}}
    }).then(
      done.bind(done, null)
    ).catch(done)
  })

  describe(`${ping.method.toUpperCase()} ${ping.uri}`, function() {
    it('should update the liveness record for the calling agent', function(done) {
      ping.callback.call(mock.express, {
        user: {id: created_user_id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.body).to.equal('pong')
        done()
      }))
    })
  })

  describe(`${list.method.toUpperCase()} ${list.uri}`, function() {
    it('should return the list of bots that have passed the liveness test in the last two minutes', function(done) {
      list.callback.call(mock.express, {
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(Array.isArray(res.body)).to.equal(true)
        expect(res.body.length > 0).to.equal(true)
        done()
      }))
    })
  })

})