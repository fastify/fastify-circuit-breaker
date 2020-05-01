'use strict'

const inherits = require('util').inherits
const fp = require('fastify-plugin')
const lru = require('tiny-lru')

const OPEN = 'open'
const HALFOPEN = 'half-open'
const CLOSE = 'close'

function circuitBreakerPlugin (fastify, opts, next) {
  opts = opts || {}
  const timeout = opts.timeout || 1000 * 10
  const resetTimeout = opts.resetTimeout || 1000 * 10
  const threshold = opts.threshold || 5
  const timeoutErrorMessage = opts.timeoutErrorMessage || 'Timeout'
  const circuitOpenErrorMessage = opts.circuitOpenErrorMessage || 'Circuit open'
  const cache = lru(opts.cache || 500)

  var routeId = 0

  fastify.decorateRequest('_cbTime', 0)
  fastify.decorateRequest('_cbIsOpen', false)
  fastify.decorateRequest('_cbRouteId', 0)
  fastify.decorate('circuitBreaker', circuitBreaker)
  fastify.addHook('onSend', onSend)

  next()

  function circuitBreaker (opts) {
    opts = opts || {}
    const thisRouteId = ++routeId
    cache.set(thisRouteId, {
      status: CLOSE,
      failures: 0,
      currentlyRunningRequest: 0,
      isResetTimerRunning: false,
      threshold: opts.threshold || threshold,
      timeout: opts.timeout || timeout,
      resetTimeout: opts.resetTimeout || resetTimeout
    })
    return function beforeHandler (req, reply, next) {
      var route = cache.get(thisRouteId)
      if (route.status === OPEN) {
        req._cbIsOpen = true
        return reply.send(new CircuitOpenError())
      }

      if (route.status === HALFOPEN && route.currentlyRunningRequest >= 1) {
        req._cbIsOpen = true
        return reply.send(new CircuitOpenError())
      }

      route.currentlyRunningRequest++
      req._cbRouteId = thisRouteId
      req._cbTime = getTime()
      next()
    }
  }

  function onSend (req, reply, payload, next) {
    if (req._cbRouteId === 0 || req._cbIsOpen === true) {
      return next()
    }
    var route = cache.get(req._cbRouteId)
    route.currentlyRunningRequest--

    if (getTime() - req._cbTime > route.timeout) {
      route.failures++
      if (route.failures >= route.threshold) {
        route.status = OPEN
        runTimer(req._cbRouteId)
      }
      return next(new TimeoutError())
    }

    if (reply.raw.statusCode < 500) {
      route.status = CLOSE
      route.failures = 0
      return next()
    }

    route.failures++
    if (route.status === HALFOPEN) {
      route.status = OPEN
      runTimer(req._cbRouteId)
      return next()
    }

    if (route.failures >= route.threshold) {
      route.status = OPEN
      runTimer(req._cbRouteId)
      return next(new CircuitOpenError())
    }

    next()
  }

  function runTimer (routeId) {
    var route = cache.get(routeId)
    if (route.isResetTimerRunning === true) return
    route.isResetTimerRunning = true
    setTimeout(() => {
      route.isResetTimerRunning = false
      route.status = HALFOPEN
    }, route.resetTimeout)
  }

  function TimeoutError (message) {
    Error.call(this)
    Error.captureStackTrace(this, TimeoutError)
    this.name = 'TimeoutError'
    this.message = timeoutErrorMessage
    this.statusCode = 503
  }

  inherits(TimeoutError, Error)

  function CircuitOpenError (message) {
    Error.call(this)
    Error.captureStackTrace(this, CircuitOpenError)
    this.name = 'CircuitOpenError'
    this.message = circuitOpenErrorMessage
    this.statusCode = 503
  }

  inherits(CircuitOpenError, Error)

  function getTime () {
    var ts = process.hrtime()
    return (ts[0] * 1e3) + (ts[1] / 1e6)
  }
}

module.exports = fp(circuitBreakerPlugin, {
  fastify: '>=3.0.0',
  name: 'fastify-circuit-breaker'
})
