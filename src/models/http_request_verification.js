
module.exports = function(instance, sqlize) {
  return instance.define('http_request_verification', {
    public_key: {
      type: sqlize.TEXT,
      allowNull: false
    },
    algorithm: {
      type: sqlize.STRING,
      allowNull: false
    },
    plaintext: {
      type: sqlize.TEXT,
      allowNull: false
    },
    signature: {
      type: sqlize.TEXT,
      allowNull: false
    }
  }, {
    indexes: [
      {
        name: 'where_index_1',
        method: 'BTREE',
        fields: [
          {
            attribute: 'signature',
            order: 'ASC',
            length: 50
          },
          {
            attribute: 'algorithm',
            order: 'ASC',
            length: 20
          }
        ]
      },
      {
        name: 'where_index_2',
        method: 'BTREE',
        fields: [
          {
            attribute: 'public_key',
            order: 'ASC',
            length: 50
          },
          {
            attribute: 'algorithm',
            order: 'ASC',
            length: 20
          },
          {
            attribute: 'plaintext',
            order: 'ASC',
            length: 50
          },
          {
            attribute: 'signature',
            order: 'ASC',
            length: 50
          }
        ]
      }
    ],
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'signatures from web requests for posterity'
  })
}