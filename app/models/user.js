var db = require('../config');
var Link = require('./link');
var Click = require('./click');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  links: function() {
    return this.hasMany(Link);
  }
});

module.exports = User;
