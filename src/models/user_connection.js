
module.exports = function(instance, sqlize) {
  return instance.define('user_connection', {
    from_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    to_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    enabled: {
      type: sqlize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    timestamps: true,
    paranoid: false,
    underscored: true,
    comment: 'graph relation for users or agents'
  })
}