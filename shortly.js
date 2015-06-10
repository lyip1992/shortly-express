var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


var app = express();
var userState = false;

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: 'cookie_secret',
    // name: 'cookie_name',
    // proxy: true,
    resave: true,
    saveUninitialized: true
}));

function restrict (req, res, next) {
  if (req.session.user) {
    console.log('we found a user');
    next();
  }
  else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};

app.get('/', restrict, function(req, res){
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/create', restrict, function(req, res) {
  res.render('index');
});

app.get('/links', restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    console.log(links);
    res.send(200, links.models);
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        // req.session.username
        // console.log(req.session.user);
        new User({ username: req.session.user }).fetch()
          .then(function(found) {
            var link = new Link({
              // user_id: found.attributes.id,
              url: uri,
              title: title,
              base_url: req.headers.origin
            });

            link.save().then(function(newLink) {
              newLink.users().attach(found).then(function(){
                Links.add(newLink);
                res.send(200, newLink);
              });
            });
          });
      });
    }
  });
});

app.post('/signup', function(req, res) {

  var password = req.body.password;
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);

  new User({ username: req.body.username,
             password: hash,
             salt: salt
  }).save().then(function(found) {
    req.session.regenerate(function() {
      req.session.user = found.attributes.username;
      res.redirect('/');
    });
  });
});

app.post('/login', function(req, res) {
  db.knex('users')
    .where('username', '=', req.body.username)
    .then(function(model) {
      if( model.length ) return model[0].salt;
      else res.redirect('/login');
    }).then(function(salt) {
      console.log("THIS IS DA SALT ------------->", salt);
      var hashCheck = bcrypt.hashSync(req.body.password, salt);
      return db.knex('users')
        .where('password', '=', hashCheck);
    }).then(function(model) {
      if (model.length) {
        req.session.regenerate(function() {
          req.session.user = model[0].username;
          req.session.userid = model[0].id;
          res.redirect('/');
        });
      }
      else {
        res.redirect('/login');
      }
    });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
