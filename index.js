var winston = require('winston')
  , config  = require('config-url')
  , http    = require('./lib')
  ;

process.on('uncaughtException', function (err) {
  console.error(new Date().toUTCString(), 'uncaughtException', err.message);
  console.error(err.stack);
});

function main() {
  return http
          .listen({})
          .then(() => {
            winston.info('taskmill-core-logs [started] :%d', config.getUrlObject('log').port);
          });
}

if (require.main === module) {
  main();
}

module.exports = {
  main : main
}