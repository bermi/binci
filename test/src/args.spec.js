'use strict'
let initStub
const fs = require('fs')
const pkg = require('package.json')
const args = proxyquire('src/args', { './init': (...args) => initStub(...args) })
const output = require('src/output')
const utils = require('src/utils')
const services = require('src/services')
const sandbox = require('test/sandbox')

const fixtures = {
  args: { e: true, _: ['/bin/bash'] }
}
describe('args', () => {
  beforeEach(() => {
    sandbox.spy(console, 'log')
    sandbox.stub(process, 'exit')
    services.disabled = []
    services.disableAll = false
  })
  describe('init', () => {
    beforeEach(() => {
      sandbox.stub(output, 'success')
      sandbox.stub(output, 'error')
    })
    it('calls init method, outputs success and exits with 0 on success', () => {
      initStub = sinon.spy(() => Promise.resolve('foo'))
      return args.init()
        .then(() => {
          expect(output.success).to.be.calledWith('foo')
          expect(process.exit).to.be.calledWith(0)
        })
    })
    it('calls init method, outputs error and exits with 1 on failure', () => {
      initStub = sinon.spy(() => Promise.reject(new Error('foo')))
      return args.init()
        .catch(() => {
          expect(output.error).to.be.calledWith(/foo/)
          expect(process.exit).to.be.calledWith(1)
        })
    })
  })
  describe('disable', () => {
    it('assigns unique values to services.disabled array', () => {
      args.raw = { d: ['foo', 'bar', 'foo'] }
      args.disable()
      expect(services.disabled).to.deep.equal(['foo', 'bar'])
    })
    it('pushes single value to services.disabled array', () => {
      args.raw = { d: 'foo' }
      args.disable()
      expect(services.disabled).to.deep.equal(['foo'])
    })
    it('calls disableAll if * is passed as arg', () => {
      sandbox.spy(args, 'disableAll')
      args.raw = { d: '*' }
      args.disable()
      expect(args.disableAll).to.be.calledOnce()
      expect(services.disableAll).to.be.true()
    })
  })
  describe('disableAll', () => {
    it('sets services.disableAll to true', () => {
      args.raw = { 'disable-all': true }
      args.disableAll()
      expect(services.disableAll).to.be.true()
    })
  })
  describe('tasks', () => {
    beforeEach(() => {
      sinon.stub(utils, 'tasks')
    })
    afterEach(() => {
      utils.tasks.restore()
    })
    it('calls utils tasks method to list available tasks', () => {
      args.tasks()
      expect(utils.tasks).to.be.calledOnce()
      expect(process.exit).to.be.calledWith(0)
    })
  })
  describe('showHelp', () => {
    it('shows the help message and exits', () => {
      args.showHelp()
      expect(console.log).to.be.calledOnce()
      expect(process.exit).to.be.calledWith(0)
    })
  })
  describe('showVersion', () => {
    it('shows the installed version and exits', () => {
      args.showVersion()
      expect(console.log).to.be.calledWith(pkg.version)
      expect(process.exit).to.be.calledWith(0)
    })
  })
  describe('cleanupBC', () => {
    beforeEach(() => {
      sandbox.stub(utils, 'cleanup', () => Promise.resolve())
    })
    it('call utils.cleanup with no arguments', () => {
      return args.cleanupBC().then(() => {
        expect(utils.cleanup).to.be.calledOnce()
      })
    })
    it('exits code 0 on success', () => {
      return args.cleanupBC()
        .then(() => {
          expect(process.exit).to.have.been.calledOnce()
          expect(process.exit).to.have.been.calledWithExactly(0)
        })
    })
    it('exits code 1 on fail', () => {
      utils.cleanup.restore()
      sandbox.stub(utils, 'cleanup', () => Promise.reject(new Error('failed')))
      return args.cleanupBC()
        .then(() => {
          expect(process.exit).to.have.been.calledOnce()
          expect(process.exit).to.have.been.calledWithExactly(1)
        })
    })
  })
  describe('cleanupAll', () => {
    beforeEach(() => {
      sandbox.stub(utils, 'cleanup', () => Promise.resolve())
    })
    it('call utils.cleanup with no arguments', () => {
      args.cleanupAll()
      expect(utils.cleanup).to.be.calledWith(true)
    })
    it('exits code 0 on success', () => {
      return args.cleanupAll()
        .then(() => {
          expect(process.exit).to.have.been.calledOnce()
          expect(process.exit).to.have.been.calledWithExactly(0)
        })
    })
    it('exits code 1 on fail', () => {
      utils.cleanup.restore()
      sandbox.stub(utils, 'cleanup', () => Promise.reject(new Error('failed')))
      return args.cleanupAll()
        .then(() => {
          expect(process.exit).to.have.been.calledOnce()
          expect(process.exit).to.have.been.calledWithExactly(1)
        })
    })
  })
  describe('isArg', () => {
    it('returns true if argument is valid', () => {
      expect(args.isArg('f')).to.be.true()
    })
    it('displays an error and exits if argument is not valid', () => {
      expect(() => args.isArg('nope')).to.throw('Invalid argument \'nope\', please see documentation')
    })
  })
  describe('getTask', () => {
    it('returns string with task', () => {
      args.raw = { _: ['foo', 'bar'] }
      expect(args.getTask()).to.deep.equal(['foo', 'bar'])
    })
    it('returns empty string if no task specified', () => {
      args.raw = {}
      expect(args.getTask()).to.equal('')
    })
  })
  describe('parse', () => {
    it('parses args object and returns formatted config object', () => {
      args.raw = fixtures.args
      return args.parse().then(actual => {
        expect(actual).to.deep.equal({
          exec: true,
          run: ['/bin/bash']
        })
      })
    })
    it('parses args and calls an action when passed', () => {
      args.raw = { v: true }
      sandbox.stub(args, 'showVersion')
      return args.parse().then(() => {
        expect(args.showVersion).to.be.calledOnce()
      })
    })
    it('calls args init method if `init` is passed', () => {
      sinon.stub(process, 'cwd', () => __dirname)
      sandbox.stub(args, 'init')
      args.raw = { _: ['init'] }
      return args.parse().then(() => {
        expect(args.init).to.be.calledOnce()
        process.cwd.restore()
      })
    })
    it('skips init process if `init` is called but config already exists', () => {
      sandbox.stub(fs, 'statSync', () => true)
      args.raw = { v: true, _: ['init'] }
      sandbox.stub(args, 'showVersion')
      sandbox.spy(args, 'init')
      return args.parse().then(() => {
        expect(args.showVersion).to.be.calledOnce()
        expect(args.init).to.not.be.called()
      })
    })
  })
})
