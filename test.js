'use strict'

const t = require('tap')
const test = t.test
const Fastify = require('fastify')
const circuitBreaker = require('./index')

const opts = {
  schema: {
    querystring: {
      error: { type: 'boolean' },
      delay: { type: 'integer' }
    }
  }
}

test('Should respond with a 503 once the threshold has been reached', t => {
  t.plan(12)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 3,
    timeout: 1000,
    resetTimeout: 1000
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.deepEqual({
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.deepEqual({
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Circuit open',
      statusCode: 503
    }, JSON.parse(res.payload))
  })
})

test('Should respond with a 503 once the threshold has been reached (timeout)', t => {
  t.plan(15)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 3,
    timeout: 50,
    resetTimeout: 1000
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=false&delay=100', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Timeout',
      statusCode: 503
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=false&delay=100', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Timeout',
      statusCode: 503
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=false&delay=100', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Timeout',
      statusCode: 503
    }, JSON.parse(res.payload))
  })

  setTimeout(() => {
    fastify.inject('/?error=false&delay=100', (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 503)
      t.deepEqual({
        error: 'Service Unavailable',
        message: 'Circuit open',
        statusCode: 503
      }, JSON.parse(res.payload))
    })
  }, 200)
})

test('Should return 503 until the circuit is open', t => {
  t.plan(12)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 1000,
    resetTimeout: 500
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.deepEqual({
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Circuit open',
      statusCode: 503
    }, JSON.parse(res.payload))
  })

  setTimeout(() => {
    fastify.inject('/?error=false', (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 200)
      t.deepEqual({ hello: 'world' }, JSON.parse(res.payload))
    })
  }, 1000)
})

test('If the staus is half-open and there is an error the state should be open again', t => {
  t.plan(15)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 1000,
    resetTimeout: 500
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.deepEqual({
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500
    }, JSON.parse(res.payload))
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Circuit open',
      statusCode: 503
    }, JSON.parse(res.payload))
  })

  setTimeout(() => {
    fastify.inject('/?error=true', (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 500)
      t.deepEqual({
        error: 'Internal Server Error',
        message: 'kaboom',
        statusCode: 500
      }, JSON.parse(res.payload))
    })

    fastify.inject('/?error=true', (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 503)
      t.deepEqual({
        error: 'Service Unavailable',
        message: 'Circuit open',
        statusCode: 503
      }, JSON.parse(res.payload))
    })
  }, 1000)
})

test('Should customize circuit open error message', t => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 1,
    circuitOpenErrorMessage: 'Oh gosh!'
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Oh gosh!',
      statusCode: 503
    }, JSON.parse(res.payload))
  })
})

test('Should customize timeout error message', t => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 2,
    timeout: 100,
    timeoutErrorMessage: 'Oh gosh!'
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=true&delay=200', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Oh gosh!',
      statusCode: 503
    }, JSON.parse(res.payload))
  })
})

test('One route should not interfere with others', t => {
  t.plan(7)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 1
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker()
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })

    const options = { beforeHandler: fastify.circuitBreaker() }
    fastify.get('/other', options, (req, reply) => {
      reply.send({ hello: 'world' })
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.deepEqual({
      error: 'Service Unavailable',
      message: 'Circuit open',
      statusCode: 503
    }, JSON.parse(res.payload))
  })

  fastify.inject('/other', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual({ hello: 'world' }, JSON.parse(res.payload))
  })
})

test('Custom options should overwrite the globals', t => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(circuitBreaker, {
    threshold: 1
  })

  fastify.after(() => {
    opts.beforeHandler = fastify.circuitBreaker({ threshold: 2 })
    fastify.get('/', opts, (req, reply) => {
      t.is(typeof req._cbTime, 'number')
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    })
  })

  fastify.inject('/?error=true', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.deepEqual({
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500
    }, JSON.parse(res.payload))
  })
})
