'use strict'

var env = require('./env')()
var crypto = require('crypto')

var db, models, private_key

try {
  w3 = new web3(new web3.providers.HttpProvider(env.EIS_HOST))
} catch (e) {
  console.log('unable to initialise web3 instance to eis host', e)
}

var get_receipt = require('../routes/management')[23]
var express = require('../../test/mock/express')

require('./database')(
  false // disable logging
).then(function(database) {
  db = database.db
  models = database.models
  express.set('models', models)
  private_key = Buffer.from(env.EIS_ADMIN_KEY, 'hex')
  
  process.on('message', function(msg) {
    var {isa_id} = msg.isa_ledger_request
    get_receipt.callback.call(express, {}, mock.res(function(res) {
      
    }))
  }).send({ready: true})
})