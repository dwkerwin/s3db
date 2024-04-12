const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream');
const prettyStdOut = new PrettyStream();

let stream = process.stdout
// only when running in development, pretty up the output
if (process.stdout.isTTY) {
    stream = prettyStdOut
    prettyStdOut.pipe(process.stdout);
}

module.exports = bunyan.createLogger({
    name: 's3db',
    streams: [
        {
            level: process.env.LOG_LEVEL || 'info',
            stream: stream
        }
    ]
});
