'use strict';

require('newrelic');
var Hapi = require('hapi');
var config = require('./config');
var validateToken = require('./services/validate-token');
var validateUserCookie = require('./services/validate-user-cookie');

var OAMUploader = function (readyCb) {
  var hapi = new Hapi.Server({
    connections: {
      routes: {
        cors: {
          credentials: true
        }
      },
      router: {
        stripTrailingSlash: true
      }
    }
  });

  hapi.connection({ host: config.host, port: config.port });

  // Register plugins
  hapi.register([
    // logging
    { register: require('good'), options: config.logOptions },
    // exports the db as plugins.db.connection
    require('./plugins/mongodb'),
    // exports plugins.workers.spawn
    require('./plugins/workers'),
    // adds bearer-access-token scheme
    require('hapi-auth-bearer-token'),
    // Cookie auth.
    require('hapi-auth-cookie')
  ], function (err) {
    if (err) throw err;
    // Set up API token auth strategy, accepting ?access_token=... or an HTTP
    // bearer authorization header.
    // Use on a route by setting config.auth: 'api-token'.
    hapi.auth.strategy('api-token', 'bearer-access-token', {
      accessTokenName: 'access_token',
      validateFunc: validateToken(hapi.plugins.db.connection)
    });

    // Setup cookie auth.
    // Hapi cookie plugin configuration.
    hapi.auth.strategy('session', 'cookie', {
      password: '3b296ce42ec560abeabaef57379aee68249a6d7912ac19cf70f10a35021fc9df7453225c4dcd9f6defaf242e701f50bbd3f2b63616029bfcd8ddf53f406079d6',
      cookie: 'oam-uploader-api',
      redirectTo: false,
      // Change for production.
      isSecure: false,
      validateFunc: validateUserCookie(hapi.plugins.db.connection)
    });

    // Register routes
    hapi.register([
      {
        register: require('hapi-router'),
        options: {
          routes: './routes/*.js',
          ignore: './routes/_apidoc.js'
        }
      }
    ], function (err) {
      if (err) throw err;

      readyCb(hapi);
    });
  });
};

module.exports = OAMUploader;
