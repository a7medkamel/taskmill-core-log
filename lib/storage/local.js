"use strict";

var _           = require('lodash')
  , Promise     = require('bluebird')
  , onFinished  = require('on-finished')
  , path        = require('path')
  , fs          = require('fs-extra')
  , config      = require('config')
  , url         = require('url')
  , urljoin     = require('url-join')
  , mime        = require('mime-type/with-db')
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
                    Promise.fromCallback((cb) => { onFinished(res, cb); })
                  , Promise.promisify(fs.outputJson)(this.head_name, headers.toObject())
                ])
                .tap(() => {
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
                        return {
                            id      : this.id
                          , url     : urljoin(local_url, 'read', this.id)
                          , headers : result
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