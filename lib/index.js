var express     = require('express')
  , https       = require('https')
  , Promise     = require('bluebird')
  , config      = require('config')
  , _           = require('lodash')
  , util        = require('util')
  , retry       = require('bluebird-retry')
  , Reaper      = require('fs-reap')
  , fs          = require('fs')
  , onFinished  = require('on-finished')
  , gcloud      = require('./gcloud')
  , Headers     = require('./headers')
  , Cloud       = require('./storage/cloud')
  , Cache       = require('./storage/cache')
  , Local       = require('./storage/local')
  //
  , app         = express()
  ;

var gcloud_bucket = gcloud.storage.bucket('taskmill-logs');
var gcloud_bucket_cache = gcloud.storage.bucket('taskmill-cache');

app.post('/write/:id', function(req, res){
  // console.log('/write', req.headers);

  var id      = req.params.id
    , headers = new Headers(req.headers)
    , waits   = [
        (new Cloud(id)).write(headers, req)
      , (new Local(id)).write(headers, req)
    ];

  if (headers.has('x-tm-cache-max-age')) {
    waits.push((new Cache(id)).write(headers, req));
  }

  Promise
    .all(waits)
    .then(() => {
      res.send({ message : 'OK' });
    })
    .catch((err) => {
      res.status(500).send({ message : err.message });
    })
});

app.get('/metadata/:id', function(req, res, next){
  var id = req.params.id;
  (new Local(id))
        .metadata()
        .then((result) => {
          // console.log('metadata', result);
          res.send(result);
        })
        .catch(next);
});

app.get('/read/:id', function(req, res, next){
  var id    = req.params.id
    , local = new Local(id)
    ;

  Promise
    .all([ local.read(), local.metadata() ])
    .spread((stream, metadata) => {
      // console.log('metadata', metadata);
      res.set(metadata.headers);

      stream.pipe(res);
    })
    .catch(next);
});

app.get('/cache/metadata/:name/:max_age', function(req, res, next){
  var name    = req.params.name
    , max_age = Number(req.params.max_age)
    , file    = gcloud_bucket_cache.file(name)
    ;

  Promise
    .promisify(file.getMetadata, { context : file })()
    .then(function(arr){
      var updated = new Date(arr[0].updated)
        , now     = new Date()
        , max_age = arr[0].metadata['x-tm-cache-max-age'] || max_age
        , expires = new Date(updated.getTime() + (max_age * 1000))
        ;

      var ret = {
          age       : (now - updated) / 1000
        , max_age   : max_age
        , cached    : true
        , metadata  : arr[0].metadata
      };

      if (expires < now) {
        ret.expired = expires;
        ret.cached = false;
      }

      res.send(ret);
    })
    .catch(function(err){
      res.send({
          cached : false
      });
    });
});

app.get('/cache/read/:name', function(req, res, next){
  var name    = req.params.name
    , file    = gcloud_bucket_cache.file(name)
    ;

  file.createReadStream().pipe(res);
});

function listen(options, cb) {
  app.listen(config.get('http.port'), cb);

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

var reaper = new Reaper();

reaper.watch('.tmp');

// reaper.maxAge(5 * 60 * 1000);
reaper.maxAge(60 * 1000);

// todo [akamel] this will run regardless if we have files or not // should do better / save resources
setInterval(() => { reaper.run().catch(() => {}); }, 120 * 1000);

module.exports = {
    listen : listen
};