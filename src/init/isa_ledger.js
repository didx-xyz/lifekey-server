
'use strict'

var crypto = require('crypto')

var web3 = require('web3')
var tx = require('ethereumjs-tx')
var ut = require('ethereumjs-util')

var env = require('./env')()

var db, models

var get_receipt = require('../routes/management')[23]
var mock = require('../../test/mock/express')

require('./database')(
  false // disable logging
).then(function(database) {
  models = database.models
  mock.express.set('models', database.models)
  mock.express.set('db_errors', database.errors)
  try {
    var w3 = new web3(new web3.providers.HttpProvider(env.EIS_HOST))
  } catch (e) {
    console.log('unable to initialise web3 instance to eis host', e)
  }
  
  var private_key = Buffer.from(env.EIS_ADMIN_KEY, 'hex')
  var addr = `0x${ut.privateToAddress(private_key).toString('hex')}`
  
  process.on('message', function(msg) {
    var {isa_id} = msg.isa_ledger_request

    models.isa_receipt_transaction.findOne({
      where: {isa_id: isa_id}
    }).then(function(found) {
      if (found) {
        return console.log(
          'skipping isa receipt ledgering for', isa_id, 'receipt already ledgered'
        )
      }

      get_receipt.callback.call(mock.express, {
        params: {isa_id}
      }, mock.res(function(res) {
        if (res.error) {
          return console.log(
            'error calling isa_receipt', res
          )
        }
        var receipt_hash = (
          crypto.createHash(
            'sha256'
          ).update(
            Buffer.from(
              JSON.stringify(res.body),
              'utf8'
            )
          ).digest('base64')
        )

        try {
          var transaction = new tx({
            to: addr,
            from: addr,
            gasLimit: 3000000,
            gasPrice: +w3.toWei(20, 'gwei'),
            data: receipt_hash,
            value: 0
          })
          transaction.sign(private_key)
        } catch (e) {
          return console.log('error generating or signing raw transaction', e)
        }

        w3.eth.sendRawTransaction(
          `0x${transaction.serialize().toString('hex')}`,
          function(err, txhash) {
            if (err) return console.log(err)
            models.isa_receipt_transaction.create({
              isa_id: isa_id,
              transaction_hash: txhash,
              receipt_hash: receipt_hash
            }).then(function(created) {
              if (!created) {
                return console.log(
                  'error creating isa_receipt_transaction record'
                )
              }
            }).catch(console.log)
          }
        )
      }))
    }).catch(console.log)
  }).send({ready: true})
})