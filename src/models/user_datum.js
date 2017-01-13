
module.exports = function(instance, sqlize) {
  return instance.define('user_datum', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    name: {
      type: sqlize.STRING,
      allowNull: false
    },
    value: {
      type: sqlize.BLOB,
      allowNull: true
    },
    secure_mode: {
      type: sqlize.INTEGER,
      allowNull: true,
      defaultValue: 3
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'data associated with end users'
  })
}