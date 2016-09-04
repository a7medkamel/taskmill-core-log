"use strict";

var _                   = require('lodash')
  , Promise             = require('bluebird')
  , path                = require('path')
  , fs                  = require('fs-extra')
  , createOutputStream  = require('create-output-stream')
  , config              = require('config-url')
  , urljoin             = require('url-join')
  , contentType         = require('content-type')
  , parser              = require('parse-cache-control')
  , mime                = require('mime-type/with-db')
  , retry               = require('bluebird-retry')
  , Headers             = require('../headers')
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

    var ret =  Promise
                .all([
                    // note [akamel] don't use 'on-finished'/ results in partial file [when file is big]
                    Promise.fromCallback((cb) => {
                      var name  = this.body_name
                        , enc   = mime.charset(headers.get('content-type'))
                        , to    = createOutputStream(name, { defaultEncoding : enc || 'binary' })
                        ;

                      to.on('error', cb);
                      // https://github.com/nodejs/node-v0.x-archive/issues/6438
                      // writestream should fsync(2) before close(2)
                      to.once('open', (fd) => {
                        to.once('close', () => {
                          // retry(() => Promise.promisify(fs.fsync)(fd), { timeout: 500, interval: 1, backoff: 2, max_interval : 10 }).asCallback(cb);
                          retry(() => Promise.promisify(fs.stat)(name), { timeout: 100, interval: 1, backoff: 2, max_interval : 10 }).asCallback(cb);
                        });
                      });

                      stream.pipe(to);
                    })
                  , Promise.fromCallback((cb) => {
                      var name  = this.head_name
                        , to    = createOutputStream(name, { defaultEncoding : 'utf-8' })
                        ;

                      to.on('error', cb);
                      // https://github.com/nodejs/node-v0.x-archive/issues/6438
                      // writestream should fsync(2) before close(2)
                      to.once('open', (fd) => {
                        to.once('close', () => {
                          // retry(() => Promise.promisify(fs.fsync)(fd), { timeout: 500, interval: 1, backoff: 2, max_interval : 10 }).asCallback(cb);
                          retry(() => Promise.promisify(fs.stat)(name), { timeout: 100, interval: 1, backoff: 2, max_interval : 10 }).asCallback(cb);
                        });
                      });

                      to.write(JSON.stringify(options.metadata));
                      to.end();
                    })
                  // , Promise.promisify(fs.outputJson)(this.head_name, options.metadata)
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
              var p$head  = Promise.promisify(fs.readJson)(this.head_name).catchThrow((err) => { console.error('metadata/readJson', this.id, err); })
                , p$stats = Promise.promisify(fs.stat)(this.head_name).catchThrow((err) => { console.error('metadata/stat', this.id, err); })
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
              return Promise.resolve(fs.createReadStream(this.body_name)).catchThrow((err) => { console.error('read/createReadStream', this.id, err); });
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