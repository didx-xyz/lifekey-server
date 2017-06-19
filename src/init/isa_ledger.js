
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
var db, models, w3, all_time, nonces = {}

function get_next_nonce(address, callback) {
  if (typeof nonces[address] === 'undefined') {
    return w3.eth.getTransactionCount(address, function(err, nonce) {
      if (err) return callback(err, null)
      nonces[address] = nonce
      return callback(null, nonces[address])
    })
  } else {
    nonces[address] += 1
    return callback(null, nonces[address])
  }
}

var receipts = {/* txhash: {isa_id, receipt_hash} */}
var receipt_timer = setInterval(function() {
  Object.keys(receipts).forEach(function(txhash) {
    w3.eth.getTransactionReceipt(txhash, function(err, receipt) {
      if (err) return console.log(err)
      else if (receipt && ((w3.eth.blockNumber - receipt.blockNumber) >= 1)) {
        Promise.all([
          models.isa_receipt_transaction.create({
            isa_id: receipts[txhash].isa_id,
            transaction_hash: txhash,
            receipt_hash: receipts[txhash].receipt_hash
          }),
          models.information_sharing_agreement.update({
            transaction_hash: txhash
          }, {
            where: {id: receipts[txhash].isa_id}
          })
        ]).then(function(res) {
          return models.information_sharing_agreement.findOne({
            where: {transaction_hash: txhash}
          })
        }).then(function(isa) {
          if (!isa) return Promise.resolve()
          process.send({
            notification_request: {
              user_id: isa.to_did,
              notification: {
                title: 'ISA Ledgered to Blockchain',
                body: 'Your ISA has been ledgered'
              },
              data: {
                type: 'isa_ledgered',
                isa_id: receipts[txhash].isa_id,
                txid: txhash
              }
            }
          })
          process.send({
            notification_request: {
              user_id: isa.from_did,
              notification: {
                title: 'ISA Ledgered to Blockchain',
                body: 'Your ISA has been ledgered'
              },
              data: {
                type: 'isa_ledgered',
                isa_id: receipts[txhash].isa_id,
                txid: txhash
              }
            }
          })
          return Promise.resolve()
        }).then(function() {
          console.log('confirmed receipt ledgering for isa', receipts[txhash].isa_id)
          delete receipts[txhash]
          console.log('pending isa receipts', receipts)
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
    process.send({ready: false})
    return
  }

  console.log(
    'net.peerCount', w3.net.peerCount,
    'net.listening', w3.net.listening,
    'currentProvider', w3.currentProvider,
    'version.whisper', w3.version.whisper,
    'version.ethereum', w3.version.ethereum,
    'version.network', w3.version.network,
    'version.node', w3.version.node,
    'version.api', w3.version.api,
  )

  // initialise keys and address
  var private_key = Buffer.from(env.ISA_RECEIPT_KEY, 'hex')
  var addr = `0x${ut.privateToAddress(private_key).toString('hex')}`

  // ensure balance is not zero
  w3.eth.getBalance(addr, function(err, balance) {
    if (err) {
      error = true
      console.log('error getting balance for ISA_RECEIPT_KEY account', err)
    } else if (!balance) {
      error = true
      console.log('error getting balance for ISA_RECEIPT_KEY account', 'balance is not defined')
    } else if (balance.toNumber() <= 0) {
      error = true
      console.log('ISA_RECEIPT_KEY account balance too low to continue')
    } else {
      // no error that we can identify
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

          get_next_nonce(addr, function(err, nonce) {
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
                nonce: nonce,
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

      process.send({ready: !error})
    }).catch(console.log)
  })
})