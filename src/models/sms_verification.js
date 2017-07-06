
'use strict'

module.exports = function(instance, sqlize) {
  return instance.define('sms_verification', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    user_datum_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    otp: {
      type: sqlize.STRING,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: false,
    underscored: true,
    comment: 'otp to user id for phone number verifications'
  })
}