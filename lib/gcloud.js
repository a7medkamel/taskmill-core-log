var path            = require('path')
  , gcloud          = require('gcloud')
  ;

var storage = gcloud.storage({
    projectId     : 'OnCue'
  , keyFilename   : '../.key/gcloud.json'
});

module.exports = {
    $        : gcloud
  , storage  : storage
}