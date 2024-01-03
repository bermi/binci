const path = require('path')
const process = require('process')

/**
 * Method to convert a Windows path to a form that Docker accepts
 * @param {string} (winPath) path to convert
 * @returns {String} the converted path
 */
module.exports = (winPath) => {
  if (process.platform === 'win32' && path.isAbsolute(winPath)) {
    return ('/' + winPath.replace(':', '').replace(/\\/g, '/'))
  } else {
    return winPath
  }
}
