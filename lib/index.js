var express     = require('express')
  , Promise     = require('bluebird')
  , config      = require('config')
  , winston     = require('winston')
  , _           = require('lodash')
  , fs          = require('fs-extra')
  , safe_parse  = require("safe-json-parse/tuple")
  , Headers     = require('./headers')
  , Cloud       = require('./storage/cloud')
  , Cache       = require('./storage/cache')
  , Local       = require('./storage/local')
  //
  , app         = express()
  ;

app.post('/write/:etag', function(req, res){
  var etag      = req.params.etag
    , metadata  = safe_parse(req.get('__metadata'))[1] || {}
    , headers   = new Headers(metadata.headers)
    , cache     = new Cache(etag)

  // console.log('write-req', etag, headers);
  // note [akamel] ensure that the __write lock is set sync from here, otherwise a read might come in before it is set.
  cache
    .write(headers, req, { metadata : metadata }) ])
    .then(() => {
      res.send({ message : 'OK' });
    })
    .catch((err) => {
      winston.error('error writing', err)
      res.status(500).send({ message : err.message });
    });
});

app.get('/metadata/:etag', function(req, res, next){
  var etag  = req.params.etag
    , cache = new Cache(etag)
    ;

  Promise
    .all([ cache.metadata() ])
    .spread((metadata) => {
      // console.log('cache-hit', etag);
      res.send(metadata);
    })
    .catch((err) => {
      Local.debug();
      winston.error('cache-miss /metadata', etag, err);
      res.status(404).send({ message : 'not found' });
    });
});

app.get('/read/:etag', function(req, res, next){
  var etag  = req.params.etag
    , cache = new Cache(etag)
    ;

  Promise
    .all([ cache.read(), cache.metadata() ])
    .spread((stream, metadata) => {
      res.set(metadata.headers);
      res.set('Age', metadata.age);
      res.status(metadata['status-code']);

      stream.pipe(res);
    })
    .catch((err) => {
      winston.error('cache-miss /read', etag, err);
      res.status(404).send({ message : 'not found' });
    });
});

function listen(options, cb) {
  return Promise.fromCallback((cb) => {
    app.listen(config.get('log').port, cb);

    fs.ensureDir('.cache', () => {
      Cache.scan('.cache');
    });
  });
  // var opts = {};

  // if (process.env.NODE_ENV === 'production') {
  //   _.defaults(opts, {
  //       ca    : [
  //           fs.readFileSync('../.key/cert/signed/AddTrustExternalCARoot.crt')
  //         , fs.readFileSync('../.key/cert/signed/COMODORSAAddTrustCA.crt')
  //         , fs.readFileSync('../.key/cert/signed/COMODORSADomainValidationSecureServerCA.crt')
  //       ]
  //     , key   : fs.readFileSync('../.key/cert/server.key')
  //     , cert  : fs.readFileSync('../.key/cert/signed/taskmill_io.crt')
  //   });
  // }

  // https.createServer(opts, app).listen(config.get('http.port'), () => {
  //    console.log('Started!');
  // });
}

module.exports = {
    listen : listen
};