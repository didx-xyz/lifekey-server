
module.exports = function(instance, sqlize) {
  return instance.define('dropped_message', {
    owner_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    contents: {
      type: sqlize.TEXT,
      allowNull: false
    },
    dropped_at: {
      type: sqlize.DATE,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'dropped messages for lazy retrieval'
  })
}