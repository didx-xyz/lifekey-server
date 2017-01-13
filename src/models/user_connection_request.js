
module.exports = function(instance, sqlize) {
  return instance.define('user_connection_request', {
    from_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    to_id: {
      type: sqlize.INTEGER, 
      allowNull: true
    },
    to_url: {
      type: sqlize.STRING,
      allowNull: true
    },
    from_url: {
      type: sqlize.STRING,
      allowNull: true
    },
    acknowledged: {
      type: sqlize.BOOLEAN,
      allowNull: true
    },
    accepted: {
      type: sqlize.BOOLEAN,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'graph relation for users or agents'
  })
}