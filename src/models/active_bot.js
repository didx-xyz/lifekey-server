
'use strict'

module.exports = function(instance, sqlize) {
  return instance.define('active_bot', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    last_ping: {
      type: sqlize.DATE,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: false,
    underscored: true,
    comment: 'liveness checking for bot users'
  })
}