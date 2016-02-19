var express     = require('express')
  , Promise     = require('bluebird')
  , config      = require('config')
  , _           = require('lodash')
  , Headers     = require('./headers')
  , Cloud       = require('./storage/cloud')
  , Cache       = require('./storage/cache')
  , Local       = require('./storage/local')
  //
  , app         = express()
  ;

app.post('/write/:etag', function(req, res){
  var etag    = req.params.etag
    , headers = new Headers(req.headers)
    , waits   = [ (new Cache(etag)).write(headers, req) ];

  // console.log('write-req', etag, headers);
  Promise
    .all(waits)
    .then(() => {
      res.send({ message : 'OK' });
    })
    .catch((err) => {
      console.error('error writing', err)
      res.status(500).send({ message : err.message });
    });
});

app.get('/metadata/:etag', function(req, res, next){
  var etag = req.params.etag;
  // console.log('cache-req', etag);
  (new Cache(etag))
        .metadata()
        .then((result) => {
          // console.log('cache-hit', etag);
          res.send(result);
        })
        .catch((err) => {
          // console.log('cache-miss', etag);
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
      // res.status(metadata['status-code']);

      stream.pipe(res);
    })
    .catch((err) => {
      res.status(404).send({ message : 'not found' });
    });
});

function listen(options, cb) {
  app.listen(config.get('http.port'), cb);

  Cache.scan('.cache');
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