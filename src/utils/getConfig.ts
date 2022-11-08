const fs = require('fs')

module.exports = function getConfig() {
    return JSON.parse(fs.readFileSync('./app-config.json'));
}
