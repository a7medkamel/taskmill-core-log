"use strict";

var _           = require('lodash')
  , Promise     = require('bluebird')
  , path        = require('path')
  , fs          = require('fs-extra')
  , config      = require('config')
  , url         = require('url')
  , urljoin     = require('url-join')
  , contentType = require('content-type')
  , mime        = require('mime-type/with-db')
  , Headers     = require('../headers')
  ;

const local_url = url.format({
    protocol  : config.get('http.protocol')
  , hostname  : config.get('http.hostname')
  , port      : config.get('http.port')
});

// todo [akamel] replicate this concept in cloud and cache
const __writes = {};

class Storage { 
  constructor(id) {
    this.id = id;

    this.body_name = path.join('.tmp', id);
    this.head_name = path.join('.tmp', id + '.head');
  }

  write(headers, stream) {
    var enc = mime.charset(headers.get('content-type'))
      , to  = fs.createOutputStream(this.body_name, { defaultEncoding : enc || 'binary' })
      , res = stream.pipe(to);

    var ret =  Promise
                .all([
                    // note [akamel] don't use 'on-finished'/ results in partial file [when file is big]
                    new Promise((resolve, reject) => {
                      to.on('finish', () => { resolve(); });
                      to.on('error', (err) => { reject(err); });
                    })
                  , Promise.promisify(fs.outputJson)(this.head_name, headers.toObject())
                ]);

    ret
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
              return Promise
                      .promisify(fs.readJson)(this.head_name)
                      .then((result) => {
                        var headers = new Headers(result);

                        // todo [akamel] return status-code as a seperate property here as well
                        return {
                            id              : this.id
                          , url             : urljoin(local_url, 'read', this.id)
                          , headers         : result
                          , contentType     : contentType.parse(headers.get('content-type') || '')
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
}

module.exports = Storage;