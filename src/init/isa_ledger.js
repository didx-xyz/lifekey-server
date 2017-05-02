
'use strict'

var crypto = require('crypto')

var web3 = require('web3')
var tx = require('ethereumjs-tx')
var ut = require('ethereumjs-util')

var env = require('./env')()

var get_receipt = require('../routes/management')[23]
var mock = require('../../test/mock/express')

// service ready state
var error = false

// forward references
var db, models, w3, all_time

var receipts = {/* txhash: {isa_id, receipt_hash} */}
var receipt_timer = setInterval(function() {
  Object.keys(receipts).forEach(function(txhash) {
    w3.eth.getTransactionReceipt(txhash, function(err, receipt) {
      if (err) return console.log(err)
      if (receipt && ((w3.eth.blockNumber - receipt.blockNumber) >= 1)) {
        models.isa_receipt_transaction.create({
          isa_id: receipts[txhash].isa_id,
          transaction_hash: txhash,
          receipt_hash: receipts[txhash].receipt_hash
        }).then(function(created) {
          if (!created) {
            return console.log(
              'error creating isa_receipt_transaction record for isa',
              receipts[txhash].isa_id
            )
          }
          console.log('confirmed receipt ledgering for isa', receipts[txhash].isa_id)
          console.log('pending isa receipts', receipts)
          delete receipts[txhash]
        }).catch(console.log)
      }
    })
  })
}, 10 * 1000)

require('./database')(
  false // disable logging
).then(function(database) {
  models = database.models
  mock.express.set('models', database.models)
  mock.express.set('db_errors', database.errors)
  
  // intialise web3
  try {
    w3 = new web3(new web3.providers.HttpProvider(env.EIS_HOST))
  } catch (e) {
    console.log('unable to initialise web3 instance to eis host', e)
    error = true
  }
  
  // initialise keys and address
  var private_key = Buffer.from(env.ISA_RECEIPT_KEY, 'hex')
  var addr = `0x${ut.privateToAddress(private_key).toString('hex')}`

  // ensure balance is not zero
  w3.eth.getBalance(addr, function(err, balance) {
    if (err) {
      error = true
      console.log('error getting balance for ISA_RECEIPT_KEY account', err)
    }

    if (balance.toNumber() <= 0) {
      error = true
      console.log('ISA_RECEIPT_KEY account balance too low to continue')
    }

    // find any existing receipt ledgerings
    models.isa_receipt_transaction.findAll().then(function(found) {
      all_time = {}
      found.map(function(irt) {
        return irt.isa_id
      }).forEach(function(id) {
        all_time[id] = true
      })
      return Promise.resolve()
    }).then(function() {

      // register service message handler
      process.on('message', function(msg) {

        var {isa_id} = msg.isa_ledger_request
        
        if (isa_id in all_time) {
          return console.log(
            'skipping receipt ledgering for',
            isa_id,
            'receipt ledgering either in progress or already ledgered'
          )
        }

        // LOCK
        all_time[isa_id] = true

        get_receipt.callback.call(mock.express, {
          skip_relation_check: true,
          params: {isa_id: isa_id}
        }, mock.res(function(res) {
          if (res.error) {
            
            // UNLOCK
            delete all_time[isa_id]
            
            return console.log(
              'error calling GET /management/receipt/:isa_id',
              res
            )
          }
          var receipt_hash = crypto.createHash(
            'sha256'
          ).update(
            Buffer.from(
              JSON.stringify(res.body),
              'utf8'
            )
          ).digest('base64')

          w3.eth.getTransactionCount(addr, function(err, nonce) {
            if (err) {

              // UNLOCK
              delete all_time[isa_id]

              return console.log(
                'error getting nonce for isa receipt ledgering account',
                err
              )
            }
            try {
              var transaction = new tx({
                to: addr,
                from: addr,
                gasLimit: 3000000,
                gasPrice: +w3.toWei(20, 'gwei'),
                data: receipt_hash,
                nonce: nonce + 1,
                value: 0
              })
              transaction.sign(private_key)
            } catch (e) {
              
              // UNLOCK
              delete all_time[isa_id]
              
              return console.log(
                'error generating or signing raw transaction for isa',
                isa_id,
                e
              )
            }

            try {
              w3.eth.sendRawTransaction(
                `0x${transaction.serialize().toString('hex')}`,
                function(err, txhash) {
                  if (err) {
                    
                    // UNLOCK
                    delete all_time[isa_id]
                    
                    return console.log('error sending txn for', isa_id, err)
                  }
                  receipts[txhash] = {
                    isa_id: isa_id,
                    receipt_hash: receipt_hash
                  }
                  console.log(
                    'awaiting txn confirmations for isa',
                    isa_id
                  )
                }
              )
            } catch (e) {
              
              // UNLOCK
              delete all_time[isa_id]
              
              return console.log(
                'error serialising transaction for raw send for isa',
                isa_id,
                e
              )
            }
          })
        }))
      })

      process.send({ready: error ? false : true})
    }).catch(console.log)
  })
})