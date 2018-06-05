
module.exports = function(instance, sqlize) {
  return instance.define('user_connection_request', {
    from_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    to_did: {
      type: sqlize.STRING, 
      allowNull: false
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
    paranoid: false,
    underscored: true,
    comment: 'graph relation for users or agents'
  })
}