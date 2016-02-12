"use strict";

var _           = require('lodash')
  , Promise     = require('bluebird')
  , onFinished  = require('on-finished')
  , path        = require('path')
  , fs          = require('fs-extra')
  , config      = require('config')
  , url         = require('url')
  , urljoin     = require('url-join')
  ;

const local_url = url.format({
    protocol  : config.get('http.protocol')
  , hostname  : config.get('http.hostname')
  , port      : config.get('http.port')
});

class Storage { 
  constructor(id) {
    this.id = id;

    this.body_name = path.join('.tmp', id);
    this.head_name = path.join('.tmp', id + '.head');
  }

  write(headers, stream) {
    var to  = fs.createOutputStream(this.body_name)
      , res = stream.pipe(to);

    return Promise
            .all([
                Promise.fromCallback((cb) => { onFinished(res, cb); })
              , Promise.promisify(fs.outputJson)(this.head_name, headers.toObject())
            ]);
  }

  metadata() {
    return Promise
            .promisify(fs.readJson)(this.head_name)
            .then((result) => {
              return {
                  id      : this.id
                , url     : urljoin(local_url, 'read', this.id)
                , headers : result
              };
            });
  }

  read() {
    return Promise.resolve(fs.createReadStream(this.body_name));
  }
}

module.exports = Storage;