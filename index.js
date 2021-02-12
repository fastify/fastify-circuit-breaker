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
  const onCircuitOpen = opts.onCircuitOpen
  const onTimeout = opts.onTimeout
  const cache = lru(opts.cache || 500)

  let routeId = 0

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
      resetTimeout: opts.resetTimeout || resetTimeout,
      onCircuitOpen: opts.onCircuitOpen || onCircuitOpen,
      onTimeout: opts.onTimeout || onTimeout
    })
    return function beforeHandler (req, reply, next) {
      const route = cache.get(thisRouteId)
      if (route.status === OPEN) {
        req._cbIsOpen = true
        if (route.onCircuitOpen) {
          try {
            const errorPayload = route.onCircuitOpen(req, reply)
            return reply.send(errorPayload)
          } catch (error) {
            return reply.send(error)
          }
        }

        return reply.send(new CircuitOpenError())
      }

      if (route.status === HALFOPEN && route.currentlyRunningRequest >= 1) {
        req._cbIsOpen = true
        if (route.onCircuitOpen) {
          try {
            const errorPayload = route.onCircuitOpen(req, reply)
            return reply.send(errorPayload)
          } catch (error) {
            return reply.send(error)
          }
        }

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
    const route = cache.get(req._cbRouteId)
    route.currentlyRunningRequest--

    if (getTime() - req._cbTime > route.timeout) {
      route.failures++
      if (route.failures >= route.threshold) {
        route.status = OPEN
        runTimer(req._cbRouteId)
      }
      if (route.onTimeout) {
        try {
          const errorPayload = route.onTimeout(req, reply)
          if (errorPayload) {
            return next(null, errorPayload)
          }
        } catch (error) {
          return next(error)
        }
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
      if (route.onCircuitOpen) {
        try {
          const errorPayload = route.onCircuitOpen(req, reply)
          return next(null, errorPayload)
        } catch (error) {
          return next(error)
        }
      }

      return next(new CircuitOpenError())
    }

    next()
  }

  function runTimer (routeId) {
    const route = cache.get(routeId)
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
    const ts = process.hrtime()
    return (ts[0] * 1e3) + (ts[1] / 1e6)
  }
}

module.exports = fp(circuitBreakerPlugin, {
  fastify: '>=3.x',
  name: 'fastify-circuit-breaker'
})
