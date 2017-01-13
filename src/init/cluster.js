
'use strict'

var fluster = require('fluster')
var lifekey = fluster({
  cluster: {
    on: {
      message: function(worker) {}
    }
  },
  workers: {
    exec: 'src/init/worker.js',
    respawn: true,
    on: {
      listening: function() {
        console.log(`SLAVE#${this.id} online`)
      },
      error: function(err) {
        console.log(`SLAVE#${this.id} error`, err)
      },
      message: function(message) {
        console.log(`SLAVE#${this.id} message`, message)
      }
    }
  }
})