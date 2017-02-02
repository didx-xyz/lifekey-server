
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
    entity: {
      type: sqlize.STRING,
      allowNull: false
    },
    attribute: {
      type: sqlize.STRING,
      allowNull: false
    },
    value: {
      type: sqlize.BLOB,
      allowNull: true
    },
    alias: {
      type: sqlize.STRING,
      allowNull: false
    },
    default: {
      type: sqlize.BOOLEAN,
      allowNull: false
    },
    archived: {
      type: sqlize.BOOLEAN,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'data associated with end users'
  })
}