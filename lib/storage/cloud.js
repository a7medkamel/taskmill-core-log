"use strict";

var _           = require('lodash')
  , Promise     = require('bluebird')
  , config      = require('config')
  , onFinished  = require('on-finished')
  , gcloud      = require('../gcloud')
  ;

var gcloud_bucket = gcloud.storage.bucket('taskmill-logs');

class Writer { 
  constructor(id) {
    this.id = id;
  }

  write(headers, stream) {
    var log_name    = this.id + '.res'
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

    var to  = gcloud_bucket.file(log_name).createWriteStream(log_options)
      , res = stream.pipe(to);

    return Promise.fromCallback((cb) => { onFinished(res, cb); })
  }

  // end(chunk, enc, cb) {
  //   this.res.end(chunk, enc, cb);
  // }
}

module.exports = Writer;