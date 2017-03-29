
'use strict'

module.exports = function(instance, sqlize) {
  return instance.define('user_action', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    purpose: {
      type: sqlize.STRING,
      allowNull: false
    },
    license: {
      type: sqlize.STRING,
      allowNull: false
    },
    entities: {
      type: sqlize.TEXT,
      allowNull: false
    },
    optional_entities: {
      type: sqlize.TEXT,
      allowNull: true
    },
    duration_days: {
      type: sqlize.INTEGER,
      allowNull: true,
      defaultValue: 365
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'crypto keys for users or agents'
  })
}