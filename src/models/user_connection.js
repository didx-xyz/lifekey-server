
module.exports = function(instance, sqlize) {
  return instance.define('user_connection', {
    from_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    to_id: {
      type: sqlize.INTEGER, 
      allowNull: true
    },
    from_did: {
      type: sqlize.STRING,
      allowNull: true
    },
    to_did: {
      type: sqlize.STRING,
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