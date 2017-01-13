
'use strict'

module.exports = function(instance, sqlize) {
  return instance.define('crypto_key', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    // TODO
    // algorithm: {},
    purpose: {
      type: sqlize.STRING,
      allowNull: false
    },
    alias: {
      type: sqlize.STRING,
      allowNull: false
    },
    private_key: {
      type: sqlize.BLOB,
      allowNull: false
    },
    public_key: {
      type: sqlize.BLOB,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'crypto keys for users or agents'
  })
}