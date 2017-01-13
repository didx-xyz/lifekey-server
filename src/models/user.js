
module.exports = function(instance, sqlize) {
  return instance.define('user', {
    did: {
      type: sqlize.STRING,
      unique: true,
      allowNull: true
    },
    first_name: {
      type: sqlize.STRING,
      allowNull: true
    },
    last_name: {
      type: sqlize.STRING,
      allowNull: true
    },
    email: {
      type: sqlize.STRING,
      allowNull: false,
      unique: true,
      validate: {isEmail: true}
    },
    password: {
      type: sqlize.BLOB,
      allowNull: false
    },
    // TODO
    // verified: {}
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'end users'
  })
}