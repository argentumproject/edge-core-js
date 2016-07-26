var FakeStorage = require('./test/fake/fakeStorage.js').FakeStorage
var realServer = require('./test/fake/realServer.js')
var abc = require('./src/abc.js')

// Set up the command-line options parser:
var getopt = require('node-getopt').create([
  ['u', 'username=ARG', 'Username'],
  ['p', 'password=ARG', 'Password'],
  ['w', 'wallet=ARG', 'Wallet ID']
]).bindHelp()

// Parse the options:
var opt = getopt.parseSystem()
if (opt.argv.length < 1) {
  getopt.showHelp()
}
var command = opt.argv[0]

function passwordSet(opt) {
  var fakeStorage = new FakeStorage()

  if (opt.argv.length < 2)
    return console.log('new password missing')
  var newPassword = opt.argv[1]

  var ctx = new abc.Context(realServer.authRequest, fakeStorage)
  ctx.passwordLogin(opt.options.username, opt.options.password, function (err, account) {
    if (err) return console.log(err)
    account.passwordSetup(newPassword, function (err) {
      if (err) return console.log(err)
      console.log('done')
    })
  })
}

if (command === 'password-set') {
  passwordSet(opt)
} else {
  console.log('not a known command: ' + command)
}
