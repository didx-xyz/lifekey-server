
module.exports = function(instance, sqlize) {
  return instance.define('consent_schema', {
    uri: {
      type: sqlize.STRING,
      allowNull: false,
      unique: true
    },
    schema: {
      type: sqlize.BLOB({length: 'medium'}),
      allowNull: false
    },
    version: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    schemaNo: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    credDefId: {
      type: sqlize.INTEGER,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'consent schemas'
  })
}