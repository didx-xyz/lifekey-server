
'use strict'

module.exports = function(instance, sqlize) {
  return instance.define('crypto_key', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    algorithm: {
      type: sqlize.STRING,
      allowNull: false
    },
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
      allowNull: true
    },
    public_key: {
      type: sqlize.BLOB,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'crypto keys for users or agents'
  })
}