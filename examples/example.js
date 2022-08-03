'use strict'

const fastify = require('fastify')()

fastify.register(require('..'), {
  threshold: 3,
  timeout: 5000,
  resetTimeout: 5000
})

fastify.register(function (instance, opts, next) {
  instance.route({
    method: 'GET',
    url: '/',
    schema: {
      querystring: {
        error: { type: 'boolean' },
        delay: { type: 'number' }
      }
    },
    beforeHandler: fastify.circuitBreaker(),
    handler: function (req, reply) {
      setTimeout(() => {
        reply.send(
          req.query.error ? new Error('kaboom') : { hello: 'world' }
        )
      }, req.query.delay || 0)
    }
  })
  next()
})

fastify.listen(3000, err => {
  if (err) throw err
  console.log('Server listening at http://localhost:3000')
})
