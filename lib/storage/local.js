"use strict";

var _           = require('lodash')
  , Promise     = require('bluebird')
  , path        = require('path')
  , fs          = require('fs-extra')
  , config      = require('config-url')
  , urljoin     = require('url-join')
  , contentType = require('content-type')
  , parser      = require('parse-cache-control')
  , mime        = require('mime-type/with-db')
  , Headers     = require('../headers')
  ;

Promise.config({ cancellation: true });

// todo [akamel] replicate this concept in cloud and cache
const __writes = {};
const __pending_writes = {};

class Storage { 
  constructor(id, options) {
    options = _.defaults({}, options, {
        dir : '.tmp'
    });

    this.id = id;

    this.body_name = path.join(options.dir, id);
    this.head_name = path.join(options.dir, id + '.head');
  }

  write(headers, stream, options) {
    // current approach is to ignore all writes w/ same id until this one is done
    if (__writes[this.id]) {
      return Promise.resolve();
    }

    var enc   = mime.charset(headers.get('content-type'))
      , to    = fs.createOutputStream(this.body_name, { defaultEncoding : enc || 'binary' })
      , body  = stream.pipe(to);

    var ret =  Promise
                .all([
                    // note [akamel] don't use 'on-finished'/ results in partial file [when file is big]
                    Promise.fromCallback((cb) => {
                      body.on('close', cb);
                      body.on('error', cb);
                    })
                  , Promise.promisify(fs.outputJson)(this.head_name, options.metadata)
                ])
                .finally(() => {
                  delete __writes[this.id];
                });

    __writes[this.id] = ret;

    return ret;
  }

  metadata() {
    return Promise
            .resolve(__writes[this.id])
            .then(() => {
              var p$head  = Promise.promisify(fs.readJson)(this.head_name)
                , p$stats = Promise.promisify(fs.stat)(this.head_name)
                ;

              return Promise
                      .all([ p$head, p$stats ])
                      .spread((result, stats) => {
                        var headers       = new Headers(result.headers)
                          , content_type  = headers.get('content-type')
                          , cache         = parser(headers.get('cache-control')) || {}
                          , age           = (Date.now() - stats.ctime) / 1000 //in seconds
                          ;

                        // todo [akamel] return status-code as a seperate property here as well
                        return {
                            id              : this.id
                          , url             : urljoin(config.getUrl('log'), 'read', this.id)
                          , headers         : headers.toObject()
                          , 'status-code'   : result['status-code']
                          , contentType     : !_.isEmpty(content_type) ? contentType.parse(content_type) : { }
                          , age             : age
                          , ttl             : cache['max-age'] - age
                          , 'max-age'       : cache['max-age']
                        };
                      });
            });
  }

  read() {
    return Promise
            .resolve(__writes[this.id])
            .then(() => {
              return Promise.resolve(fs.createReadStream(this.body_name));
            });
  }

  // todo [akamel] wait for eads to end before deleting
  delete() {
    fs.remove(this.body_name, (err) => {
      if (err) {
        console.log('error deleting file:', this.body_name, err);
      }
    });

    fs.remove(this.head_name, (err) => {
      if (err) {
        console.log('error deleting file:', this.head_name, err);
      }
    });
  }
}

module.exports = Storage;