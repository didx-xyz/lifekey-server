
module.exports = function(instance, sqlize) {
  return instance.define('user', {
    did: {
      type: sqlize.STRING,
      unique: true,
      allowNull: true
    },
    did_address: {
      type: sqlize.STRING,
      allowNull: true,
      unique: true
    },
    nickname: {
      type: sqlize.STRING,
      allowNull: false
    },
    host_address: {
      type: sqlize.STRING,
      allowNull: true
    },
    email: {
      type: sqlize.STRING,
      allowNull: false,
      unique: true,
      validate: {isEmail: true}
    },
    webhook_url: {
      type: sqlize.STRING,
      allowNull: true,
      unique: true
    },
    actions_url: {
      type: sqlize.STRING,
      allowNull: true,
      unique: true
    },
    web_auth_url: {
      type: sqlize.STRING,
      allowNull: true,
      unique: true
    },
    display_name: {
      type: sqlize.TEXT,
      allowNull: true,
      unique: false
    },
    contact_email: {
      type: sqlize.TEXT,
      allowNull: true,
      validate: {isEmail: true}
    },
    contact_tel: {
      type: sqlize.STRING,
      allowNull: true
    },
    contact_address: {
      type: sqlize.TEXT,
      allowNull: true
    },
    branding_image_uri: {
      type: sqlize.TEXT,
      allowNull: true
    },
    branding_colour_code: {
      type: sqlize.STRING,
      allowNull: true,
      defaultValue: '#1A7BFF'
    },
    contact_email: {
      type: sqlize.STRING,
      allowNull: true,
      validate: {isEmail: true}
    },
    app_activation_code: {
      type: sqlize.STRING,
      allowNull: false
    },
    app_activation_link_clicked: {
      type: sqlize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    timestamps: true,
    paranoid: false,
    underscored: true,
    comment: 'end users'
  })
}