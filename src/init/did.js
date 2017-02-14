
'use strict'

function eis_register() {}

require('./database')(false).then(function(database) {
  
  var {db, models} = database
  
  process.on('message', function(msg) {
    if (msg.did_allocation_request) {
      // inspect the envelope
      // call a smart contract
      // reply to requesting client
      // via firebase push or webhook
    }
  }).send({ready: true})
  
})

// simulate work for now...
setInterval(function() {
  process.send({now: Date.now()})
}, 1000 * 60)