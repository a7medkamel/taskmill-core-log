var path            = require('path')
  , gcloud          = require('gcloud')
  ;

var storage = gcloud.storage({
    projectId     : 'OnCue'
  , keyFilename   : path.join(__dirname, '../../.keys/gcloud.json')
});

module.exports = {
    $        : gcloud
  , storage  : storage
}