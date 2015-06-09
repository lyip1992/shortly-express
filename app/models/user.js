var db = require('../config');
var Promise = require('bluebird');
var Link = require('./link');
var Click = require('./click');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  links: function() {
    return this.hasMany(Link);
  }
});

module.exports = User;
