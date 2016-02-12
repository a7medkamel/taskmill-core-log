"use strict";

var _           = require('lodash')
  , Promise     = require('bluebird')
  , config      = require('config')
  , onFinished  = require('on-finished')
  , gcloud      = require('../gcloud')
  ;

var gcloud_bucket = gcloud.storage.bucket('taskmill-cache');

class Writer { 
  constructor(id) {
    this.id = id;
  }

  write(headers, stream) {
    var max_age     = Number(headers.get('x-tm-cache-max-age'))
      , http_code   = Number(headers.get('x-tm-statuscode')) || 200
      ;

    var log_name    = headers.get('x-tm-cache-key')
      , log_options = {
          resumable : false
        , gzip      : false
        , metadata  : {
              cacheControl      : 'public, max-age=' + config.get('log.max-age')
            , contentType       : headers.get('content-type')
            , contentEncoding   : headers.get('content-encoding')
            , metadata          : headers.toObject()
          }
      };

    // only cache if max_age is > 0; otherwise assume that req is disabeling cache for this call
    if (
            http_code >= 200
        &&  http_code < 300
        &&  _.isFinite(max_age)
        && max_age > 0
      ) {

      var to  = gcloud_bucket.file(log_name).createWriteStream(log_options)
        , res = stream.pipe(to);

      return Promise.fromCallback((cb) => { onFinished(res, cb); })
    }
  }

  // end(chunk, enc, cb) {
  //   this.res.end(chunk, enc, cb);
  // }
}

module.exports = Writer;