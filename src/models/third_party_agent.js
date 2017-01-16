
// agents are third party services acting on behalf of users

// TODO
// agents should be subject to same code as regular users
// they must exercise a signing key to be served a token

module.exports = function(instance, sqlize) {
  return instance.define('third_party_agent', {
    user_id: { // for whom they act
      type: sqlize.INTEGER,
      allowNull: false
    },
    name: {
      type: sqlize.STRING,
      allowNull: true
    },
    // TODO
    // email: {}
    // verified: {}
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'third-party services'
  })
}