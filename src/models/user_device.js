
'use strict'

module.exports = function(instance, sqlize) {
  return instance.define('user_device', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false,
      unique: true
    },
    platform: {
      type: sqlize.STRING,
      allowNull: false
    },
    device_id: {
      type: sqlize.TEXT,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'push notification destinations for users'
  })
}