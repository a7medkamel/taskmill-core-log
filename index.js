var winston = require('winston')
  , config  = require('config')
  , http    = require('./lib')
  ;

process.on('uncaughtException', function (err) {
  console.error(new Date().toUTCString(), 'uncaughtException', err.message);
  console.error(err.stack);
});

function main() {
  http.listen({}, () => {
    winston.info('taskmill-core-logs [started] :%d', config.get('log.port'));
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  main : main
}