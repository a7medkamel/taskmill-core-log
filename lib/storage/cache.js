"use strict";

var _           = require('lodash')
  , Promise     = require('bluebird')
  , NodeCache   = require('node-cache')
  , fs          = require('fs-extra')
  , path        = require('path')
  , parser      = require('parse-cache-control')
  //
  , Local       = require('./local')
  ;

const __cache   = new NodeCache({ stdTTL : 60, checkperiod : 120 });

__cache.on('expired', function(key, value) {
  // console.log('killing at', key);

  (new Writer(key, { dir : '.cache' })).delete();
});

class Writer extends Local { 
  constructor(id, options) {
    options = _.defaults({ dir : '.cache' }, options);

    super(id, options);
  }

  write(headers, stream) {
    var cache   = parser(headers.get('cache-control')) || {}
      , max_age = Number(cache['max-age'])
      ;

    if (cache['max-age'] > 0 ) {
      return super
              .write(headers, stream)
              .then(() => {
                __cache.set(this.id, undefined, cache['max-age']);
              });
    }
  }

  // end(chunk, enc, cb) {
  //   this.res.end(chunk, enc, cb);
  // }

  static scan(dir, cb) {
    Promise
      .promisify(fs.readdir)(dir)
      .then((files) => {
        var heads = _.filter(files, (filename) => { return path.extname(filename) === '.head'; })

        return Promise
                .map(heads, (filename) => {
                  var cache = new Writer(path.basename(filename, '.head'));

                  return cache
                          .metadata()
                          .then((metadata) => {
                            if (metadata.ttl <= 0) {
                              return cache.delete();
                            }
                            
                            __cache.set(cache.id, undefined, metadata.ttl);
                          })
                });
      })
      .nodeify(cb);
  }
}

module.exports = Writer;