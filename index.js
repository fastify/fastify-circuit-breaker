'use strict'

const fp = require('fastify-plugin')
const lru = require('tiny-lru').lru
const createError = require('@fastify/error')

const OPEN = Symbol('open')
const HALFOPEN = Symbol('half-open')
const CLOSE = Symbol('close')

function fastifyCircuitBreaker (fastify, opts, next) {
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
    return async function beforeHandler (req, reply) {
      const route = cache.get(thisRouteId)
      if (route.status === OPEN) {
        req._cbIsOpen = true
        if (route.onCircuitOpen) {
          const errorPayload = await route.onCircuitOpen(req, reply)
          return reply.send(errorPayload)
        }

        return reply.send(new CircuitOpenError())
      }

      if (route.status === HALFOPEN && route.currentlyRunningRequest >= 1) {
        req._cbIsOpen = true
        if (route.onCircuitOpen) {
          const errorPayload = await route.onCircuitOpen(req, reply)
          return reply.send(errorPayload)
        }

        throw new CircuitOpenError()
      }

      route.currentlyRunningRequest++
      req._cbRouteId = thisRouteId
      req._cbTime = getTime()
    }
  }

  async function onSend (req, reply, payload) {
    if (req._cbRouteId === 0 || req._cbIsOpen === true) {
      return
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
        const errorPayload = await route.onTimeout(req, reply)
        return errorPayload
      }

      const err = new TimeoutError()
      reply.code(err.statusCode)
      throw err
    }

    if (reply.raw.statusCode < 500) {
      route.status = CLOSE
      route.failures = 0
      return
    }

    route.failures++
    if (route.status === HALFOPEN) {
      route.status = OPEN
      runTimer(req._cbRouteId)
      return
    }

    if (route.failures >= route.threshold) {
      route.status = OPEN
      runTimer(req._cbRouteId)
      if (route.onCircuitOpen) {
        const errorPayload = await route.onCircuitOpen(req, reply)
        return errorPayload
      }

      const err = new CircuitOpenError()
      reply.code(err.statusCode)
      throw err
    }
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

  const TimeoutError = createError(
    'FST_ERR_CIRCUIT_BREAKER_TIMEOUT',
    timeoutErrorMessage,
    503
  )

  const CircuitOpenError = createError(
    'FST_ERR_CIRCUIT_BREAKER_OPEN',
    circuitOpenErrorMessage,
    503
  )

  function getTime () {
    const ts = process.hrtime()
    return (ts[0] * 1e3) + (ts[1] / 1e6)
  }
}

module.exports = fp(fastifyCircuitBreaker, {
  fastify: '4.x',
  name: '@fastify/circuit-breaker'
})
module.exports.default = fastifyCircuitBreaker
module.exports.fastifyCircuitBreaker = fastifyCircuitBreaker
