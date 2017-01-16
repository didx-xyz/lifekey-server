
module.exports = function(instance, sqlize) {
  return instance.define('token', {
    owner_id: {
      type: sqlize.INTEGER,
      unique: true,
      allowNull: false
    },
    value: {
      type: sqlize.STRING,
      allowNull: false
    },
    expires_at: {
      type: sqlize.DATE,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'tokens for users or agents'
  })
}