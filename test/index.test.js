'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const circuitBreaker = require('..')
const { setTimeout: sleep } = require('timers/promises')

const opts = {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        error: { type: 'boolean' },
        delay: { type: 'integer' }
      }
    }
  }
}

test('Should respond with a 503 once the threshold has been reached', async t => {
  t.plan(12)

  const fastify = Fastify()
  await fastify.register(circuitBreaker, {
    threshold: 3,
    timeout: 1000,
    resetTimeout: 1000
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  let res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual({
    error: 'Internal Server Error',
    message: 'kaboom',
    statusCode: 500
  }, JSON.parse(res.payload))

  res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual({
    error: 'Internal Server Error',
    message: 'kaboom',
    statusCode: 500
  }, JSON.parse(res.payload))

  res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'Circuit open',
    statusCode: 503,
    code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
  }, JSON.parse(res.payload))
})

test('Should respond with a 503 once the threshold has been reached (timeout)', async t => {
  t.plan(15)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 3,
    timeout: 50,
    resetTimeout: 1000
  })

  fastify.after(() => {
    const routeOpts = { ...opts, preHandler: fastify.circuitBreaker() }
    fastify.get('/', routeOpts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  const responses = await Promise.all([
    fastify.inject('/?error=false&delay=100'),
    fastify.inject('/?error=false&delay=100'),
    fastify.inject('/?error=false&delay=100')
  ])

  for (const res of responses) {
    t.assert.ok(res)
    t.assert.strictEqual(res.statusCode, 503)
    t.assert.deepStrictEqual({
      error: 'Service Unavailable',
      message: 'Timeout',
      statusCode: 503,
      code: 'FST_ERR_CIRCUIT_BREAKER_TIMEOUT'
    }, JSON.parse(res.payload))
  }

  const res = await fastify.inject('/?error=false&delay=100')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'Circuit open',
    statusCode: 503,
    code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
  }, JSON.parse(res.payload))
})

test('Should return 503 until the circuit is open', async t => {
  t.plan(12)

  const fastify = Fastify()
  await fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 1000,
    resetTimeout: 500
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  let res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual({
    error: 'Internal Server Error',
    message: 'kaboom',
    statusCode: 500
  }, JSON.parse(res.payload))

  res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'Circuit open',
    statusCode: 503,
    code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
  }, JSON.parse(res.payload))

  await sleep(1000)
  res = await fastify.inject('/?error=false')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual({ hello: 'world' }, JSON.parse(res.payload))
})

test('If the staus is half-open and there is an error the state should be open again', async t => {
  t.plan(15)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 1000,
    resetTimeout: 500
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.assert.ifError(err)
    t.assert.strictEqual(res.statusCode, 500)
    t.assert.deepStrictEqual({
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=true', (err, res) => {
    t.assert.ifError(err)
    t.assert.strictEqual(res.statusCode, 503)
    t.assert.deepStrictEqual({
      error: 'Service Unavailable',
      message: 'Circuit open',
      statusCode: 503,
      code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
    }, JSON.parse(res.payload))
  })

  setTimeout(() => {
    fastify.inject('/?error=true', (err, res) => {
      t.assert.ifError(err)
      t.assert.strictEqual(res.statusCode, 500)
      t.assert.deepStrictEqual({
        error: 'Internal Server Error',
        message: 'kaboom',
        statusCode: 500
      }, JSON.parse(res.payload))
    })

    fastify.inject('/?error=true', (err, res) => {
      t.assert.ifError(err)
      t.assert.strictEqual(res.statusCode, 503)
      t.assert.deepStrictEqual({
        error: 'Service Unavailable',
        message: 'Circuit open',
        statusCode: 503,
        code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
      }, JSON.parse(res.payload))
    })
  }, 1000)

  await sleep(1200)
})

test('Should customize circuit open error message', async t => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 1,
    circuitOpenErrorMessage: 'Oh gosh!'
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  const res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'Oh gosh!',
    statusCode: 503,
    code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
  }, JSON.parse(res.payload))
})

test('Should customize timeout error message', async t => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 100,
    timeoutErrorMessage: 'Oh gosh!'
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  const res = await fastify.inject('/?error=true&delay=200')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'Oh gosh!',
    statusCode: 503,
    code: 'FST_ERR_CIRCUIT_BREAKER_TIMEOUT'
  }, JSON.parse(res.payload))
})

test('One route should not interfere with others', async t => {
  t.plan(7)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 1
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })

    const options = { beforeHandler: fastify.circuitBreaker() }
    fastify.get('/other', options, (_req, reply) => {
      reply.send({ hello: 'world' })
    })
  })

  let res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'Circuit open',
    statusCode: 503,
    code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
  }, JSON.parse(res.payload))

  res = await fastify.inject('/other')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual({ hello: 'world' }, JSON.parse(res.payload))
})

test('Custom options should overwrite the globals', async t => {
  t.plan(4)

  const fastify = Fastify()
  await fastify.register(circuitBreaker, {
    threshold: 1
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker({ threshold: 2 })
    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  const res = await fastify.inject('/?error=true')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual({
    error: 'Internal Server Error',
    message: 'kaboom',
    statusCode: 500
  }, JSON.parse(res.payload))
})

test('Should handle also errors with statusCode property', async t => {
  t.plan(6)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (_req, reply) => {
      const error = new Error('kaboom')
      error.statusCode = 501
      reply.send(error)
    })
  })

  let res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 501)
  t.assert.deepStrictEqual({
    error: 'Not Implemented',
    message: 'kaboom',
    statusCode: 501
  }, JSON.parse(res.payload))

  res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'Circuit open',
    statusCode: 503,
    code: 'FST_ERR_CIRCUIT_BREAKER_OPEN'
  }, JSON.parse(res.payload))
})

test('If a route is not under the circuit breaker, _cbRouteId should always be equal to 0', async t => {
  t.plan(8)

  const fastify = Fastify()
  fastify.register(circuitBreaker)

  fastify.get('/first', (req, reply) => {
    t.assert.strictEqual(req._cbRouteId, 0)
    reply.send({ hello: 'world' })
  })

  fastify.get('/second', (req, reply) => {
    t.assert.strictEqual(req._cbRouteId, 0)
    reply.send({ hello: 'world' })
  })

  let res = await fastify.inject('/first')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual({ hello: 'world' }, JSON.parse(res.payload))

  res = await fastify.inject('/second')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual({ hello: 'world' }, JSON.parse(res.payload))
})

test('Should work only if the status code is >= 500', async t => {
  t.plan(6)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 1
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()
    fastify.get('/first', opts, (_req, reply) => {
      const error = new Error('kaboom')
      error.statusCode = 400
      reply.send(error)
    })

    fastify.get('/second', opts, (_req, reply) => {
      reply.code(400).send(new Error('kaboom'))
    })
  })

  let res = await fastify.inject('/first')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 400)
  t.assert.deepStrictEqual({
    error: 'Bad Request',
    message: 'kaboom',
    statusCode: 400
  }, JSON.parse(res.payload))

  res = await fastify.inject('/second')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 400)
  t.assert.deepStrictEqual({
    error: 'Bad Request',
    message: 'kaboom',
    statusCode: 400
  }, JSON.parse(res.payload))
})

test('Should call onCircuitOpen when the threshold has been reached', async t => {
  t.plan(6)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    onCircuitOpen: (_req, reply) => {
      reply.statusCode = 503
      return JSON.stringify({ message: 'hi' })
    }
  })

  fastify.after(() => {
    fastify.get('/', { preHandler: fastify.circuitBreaker() }, (_req, reply) => {
      reply.send(new Error('kaboom'))
    })
  })

  let res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual({
    error: 'Internal Server Error',
    message: 'kaboom',
    statusCode: 500
  }, JSON.parse(res.payload))

  res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    message: 'hi'
  }, JSON.parse(res.payload))
})

test('Should call onTimeout when the timeout has been reached', async t => {
  t.plan(3)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    timeout: 50,
    onTimeout: (_req, reply) => {
      reply.statusCode = 504
      return 'timed out'
    }
  })

  fastify.after(() => {
    fastify.get('/', { preHandler: fastify.circuitBreaker() }, (_req, reply) => {
      setTimeout(() => {
        reply.send({ hello: 'world' })
      }, 100)
    })
  })

  const res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 504)
  t.assert.strictEqual(res.payload, 'timed out')
})

test('onCircuitOpen will handle a thrown error', async t => {
  t.plan(6)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    onCircuitOpen: (_req, reply) => {
      reply.statusCode = 503
      throw new Error('circuit open')
    }
  })

  fastify.after(() => {
    fastify.get('/', { preHandler: fastify.circuitBreaker() }, (_req, reply) => {
      reply.send(new Error('kaboom'))
    })
  })

  let res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual({
    error: 'Internal Server Error',
    message: 'kaboom',
    statusCode: 500
  }, JSON.parse(res.payload))

  res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'circuit open',
    statusCode: 503
  }, JSON.parse(res.payload))
})

test('onTimeout will handle a thrown error', async t => {
  t.plan(2)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    timeout: 50,
    onTimeout: (_req, reply) => {
      reply.statusCode = 504
      throw new Error('timed out')
    }
  })

  fastify.after(() => {
    fastify.get('/', { preHandler: fastify.circuitBreaker() }, (_req, reply) => {
      setTimeout(() => {
        reply.send({ hello: 'world' })
      }, 100)
    })
  })

  const res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.deepStrictEqual({
    error: 'Gateway Timeout',
    message: 'timed out',
    statusCode: 504
  }, JSON.parse(res.payload))
})

test('onCircuitOpen can be an async function', async t => {
  t.plan(6)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    onCircuitOpen: async (_req, reply) => {
      const statusCode = await Promise.resolve(503)
      reply.statusCode = statusCode
      throw new Error('circuit open')
    }
  })

  fastify.after(() => {
    fastify.get('/', { preHandler: fastify.circuitBreaker() }, (_req, reply) => {
      reply.send(new Error('kaboom'))
    })
  })

  let res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual({
    error: 'Internal Server Error',
    message: 'kaboom',
    statusCode: 500
  }, JSON.parse(res.payload))

  res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 503)
  t.assert.deepStrictEqual({
    error: 'Service Unavailable',
    message: 'circuit open',
    statusCode: 503
  }, JSON.parse(res.payload))
})

test('onTimeout can be an async function', async t => {
  t.plan(2)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    timeout: 50,
    onTimeout: async (_req, reply) => {
      const statusCode = await Promise.resolve(504)
      reply.statusCode = statusCode
      throw new Error('timed out')
    }
  })

  fastify.after(() => {
    fastify.get('/', { preHandler: fastify.circuitBreaker() }, (_req, reply) => {
      setTimeout(() => {
        reply.send({ hello: 'world' })
      }, 100)
    })
  })

  const res = await fastify.inject('/')
  t.assert.ok(res)
  t.assert.deepStrictEqual({
    error: 'Gateway Timeout',
    message: 'timed out',
    statusCode: 504
  }, JSON.parse(res.payload))
})

test('Should not throw error if no options is passed', async t => {
  t.plan(3)
  const fastify = Fastify()
  const fastify2 = Fastify()
  const fastify3 = Fastify()
  t.assert.strictEqual(circuitBreaker(fastify, undefined, () => {}), undefined)
  t.assert.strictEqual(circuitBreaker(fastify2, null, () => {}), undefined)
  t.assert.strictEqual(circuitBreaker(fastify3, {}, () => {}), undefined)
})

test('Should throw error on route status open and circuit open', async t => {
  t.plan(5)

  const fastify = Fastify()
  await fastify.register(circuitBreaker, {
    threshold: 1,
    timeout: 1000,
    resetTimeout: 1500,
    onCircuitOpen: async (_req, reply) => {
      reply.statusCode = 500
      return JSON.stringify({ err: 'custom error' })
    }
  })

  fastify.after(() => {
    fastify.get('/', { preHandler: fastify.circuitBreaker() }, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(new Error('kaboom'))
      }, 0)
    })
  })

  let res = await fastify.inject('/?error=true')
  t.assert.ok(res)

  await sleep(1000)
  res = await fastify.inject('/?error=false')
  t.assert.ok(res)
  t.assert.strictEqual(res.statusCode, 500)
  t.assert.deepStrictEqual(res.json(), { err: 'custom error' })
})

test('Should throw error on route status half open and circuit open', async t => {
  t.plan(15)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 1000,
    resetTimeout: 500,
    onCircuitOpen: async (_req, reply) => {
      reply.statusCode = 500
      return JSON.stringify({ err: 'custom error' })
    }
  })

  fastify.after(() => {
    opts.preHandler = fastify.circuitBreaker()

    fastify.get('/', opts, (req, reply) => {
      t.assert.strictEqual(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(new Error('kaboom'))
      }, 0)
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.assert.ifError(err)
    t.assert.strictEqual(res.statusCode, 500)
    t.assert.deepStrictEqual({
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=true', (err, res) => {
    t.assert.ifError(err)
    t.assert.strictEqual(res.statusCode, 500)
    t.assert.deepStrictEqual(res.json(), { err: 'custom error' })
  })

  setTimeout(() => {
    fastify.inject('/?error=true', (err, res) => {
      t.assert.ifError(err)
      t.assert.strictEqual(res.statusCode, 500)
      t.assert.deepStrictEqual({
        error: 'Internal Server Error',
        message: 'kaboom',
        statusCode: 500
      }, JSON.parse(res.payload))
    })

    fastify.inject('/?error=true', (err, res) => {
      t.assert.strictEqual(null, err)
      t.assert.strictEqual(res.statusCode, 500)
      t.assert.deepStrictEqual(res.json(), { err: 'custom error' })
    })
  }, 1000)

  await sleep(1200)
})

test('Should count a single timeout only once toward threshold', async t => {
  t.plan(9)

  const fastify = Fastify()
  await fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 30,
    resetTimeout: 100
  })

  let handlerCalls = 0
  fastify.get('/', { preHandler: fastify.circuitBreaker() }, async () => {
    handlerCalls++
    await sleep(60)
    return { hello: 'world' }
  })

  const res1 = await fastify.inject('/')
  t.assert.strictEqual(res1.statusCode, 503)
  t.assert.strictEqual(res1.json().code, 'FST_ERR_CIRCUIT_BREAKER_TIMEOUT')
  t.assert.strictEqual(handlerCalls, 1)

  const res2 = await fastify.inject('/')
  t.assert.strictEqual(res2.statusCode, 503)
  t.assert.strictEqual(res2.json().code, 'FST_ERR_CIRCUIT_BREAKER_TIMEOUT')
  t.assert.strictEqual(handlerCalls, 2)

  const res3 = await fastify.inject('/')
  t.assert.strictEqual(res3.statusCode, 503)
  t.assert.strictEqual(res3.json().code, 'FST_ERR_CIRCUIT_BREAKER_OPEN')
  t.assert.strictEqual(handlerCalls, 2)

  await sleep(120)
})

test('Should allow only a single concurrent request in half-open state after timeout', async t => {
  t.plan(4)

  const fastify = Fastify()
  await fastify.register(circuitBreaker, {
    threshold: 1,
    timeout: 30,
    resetTimeout: 80
  })

  let handlerCalls = 0
  fastify.get('/', { preHandler: fastify.circuitBreaker() }, async () => {
    handlerCalls++
    await sleep(60)
    return { hello: 'world' }
  })

  const res1 = await fastify.inject('/')
  t.assert.strictEqual(res1.statusCode, 503)
  t.assert.strictEqual(res1.json().code, 'FST_ERR_CIRCUIT_BREAKER_TIMEOUT')

  await sleep(100)

  const responses = await Promise.all([
    fastify.inject('/'),
    fastify.inject('/')
  ])
  const codes = responses.map(res => res.json().code).sort()
  t.assert.deepStrictEqual(codes, [
    'FST_ERR_CIRCUIT_BREAKER_OPEN',
    'FST_ERR_CIRCUIT_BREAKER_TIMEOUT'
  ])
  t.assert.strictEqual(handlerCalls, 2)

  await sleep(100)
})

test('Should not re-execute onSend hooks on non-Error 500 or thrown onTimeout/onCircuitOpen errors', async t => {
  t.plan(7)

  let onTimeoutCalls = 0
  const timeoutApp = Fastify()
  await timeoutApp.register(circuitBreaker, {
    threshold: 2,
    timeout: 30,
    resetTimeout: 100,
    onTimeout: (_req, reply) => {
      onTimeoutCalls++
      reply.statusCode = 504
      throw new Error('timed out')
    }
  })

  timeoutApp.get('/', { preHandler: timeoutApp.circuitBreaker() }, async () => {
    await sleep(60)
    return { hello: 'world' }
  })

  const tRes1 = await timeoutApp.inject('/')
  t.assert.strictEqual(tRes1.statusCode, 504)
  t.assert.strictEqual(onTimeoutCalls, 1)

  const tRes2 = await timeoutApp.inject('/')
  t.assert.strictEqual(tRes2.statusCode, 504)
  t.assert.strictEqual(onTimeoutCalls, 2)

  await sleep(120)

  let onCircuitOpenCalls = 0
  let halfOpenHandlerCalls = 0
  const openApp = Fastify()
  await openApp.register(circuitBreaker, {
    threshold: 1,
    timeout: 1000,
    resetTimeout: 80,
    onCircuitOpen: (_req, reply) => {
      onCircuitOpenCalls++
      reply.statusCode = 503
      throw new Error('custom open')
    }
  })

  openApp.get('/', { preHandler: openApp.circuitBreaker() }, async (_req, reply) => {
    halfOpenHandlerCalls++
    await sleep(40)
    return reply.code(500).send({ ok: false })
  })

  const oRes1 = await openApp.inject('/')
  t.assert.strictEqual(oRes1.statusCode, 503)
  t.assert.strictEqual(onCircuitOpenCalls, 1)

  await sleep(100)

  await Promise.all([
    openApp.inject('/'),
    openApp.inject('/')
  ])
  t.assert.strictEqual(halfOpenHandlerCalls, 2)

  await sleep(100)
})

test('Should not start duplicate reset timers when concurrent requests exceed threshold', async t => {
  t.plan(4)

  const fastify = Fastify()
  await fastify.register(circuitBreaker, {
    threshold: 1,
    timeout: 30,
    resetTimeout: 80
  })

  fastify.get('/', { preHandler: fastify.circuitBreaker() }, async req => {
    await sleep(req.query.delay ? Number(req.query.delay) : 60)
    return { hello: 'world' }
  })

  const responses = await Promise.all([
    fastify.inject('/?delay=60'),
    fastify.inject('/?delay=70')
  ])
  t.assert.strictEqual(responses[0].json().code, 'FST_ERR_CIRCUIT_BREAKER_TIMEOUT')
  t.assert.strictEqual(responses[1].json().code, 'FST_ERR_CIRCUIT_BREAKER_TIMEOUT')

  await sleep(100)

  const probe = await fastify.inject('/?delay=0')
  t.assert.strictEqual(probe.statusCode, 200)
  t.assert.deepStrictEqual(probe.json(), { hello: 'world' })
})
