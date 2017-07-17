
var process_send_call_data = []

module.exports = {
  send: function(msg, on_send) {
    process_send_call_data.push(msg)
    if (typeof on_send === 'function') on_send()
    return true
  },
  send_call_data: function() {
    return process_send_call_data
  },
  get_last_call_data: function() {
    return process_send_call_data[process_send_call_data.length - 1]
  },
  get_nth_call_data: function(nth) {
    return process_send_call_data[
      nth < 0 ?
      process_send_call_data.length + nth :
      nth - 1
    ]
  }
}
