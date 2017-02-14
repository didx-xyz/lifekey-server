
module.exports = function(instance, sqlize) {
  return instance.define('user_datum', {
    owner_id: {
      type: sqlize.INTEGER,
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
      allowNull: false
    },
    mime: {
      type: sqlize.STRING,
      allowNull: false,
      defaultValue: 'application/json+ld'
    },
    encoding: {
      type: sqlize.STRING,
      allowNull: true,
      defaultValue: 'utf8'
    },
    alias: {
      type: sqlize.STRING,
      allowNull: false
    },
    is_default: {
      type: sqlize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_archived: {
      type: sqlize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'data associated with end users'
  })
}