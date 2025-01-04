import fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { expectType } from 'tsd'
import FastifyCircuitBreaker, { FastifyCircuitBreakerOptions } from '..'

const app = fastify()

app.register(FastifyCircuitBreaker)
app.register(FastifyCircuitBreaker, {})
app.register(FastifyCircuitBreaker, { timeout: 5000 })
app.register(FastifyCircuitBreaker, { threshold: 5 })
app.register(FastifyCircuitBreaker, { resetTimeout: 10000 })
app.register(FastifyCircuitBreaker, {
  timeout: 5000,
  threshold: 5,
  resetTimeout: 10000,
})

const fastifyCircuitBreakerOptions: FastifyCircuitBreakerOptions = {
  timeout: 5000,
  threshold: 5,
  resetTimeout: 10000,
}
app.register(FastifyCircuitBreaker, fastifyCircuitBreakerOptions)

app.get(
  '/',
  {
    preHandler: app.circuitBreaker(),
  },
  () => { }
)

app.register(FastifyCircuitBreaker, { timeoutErrorMessage: 'Timeon' })
app.register(FastifyCircuitBreaker, {
  onTimeout: async (req, reply) => {
    expectType<FastifyRequest>(req)
    expectType<FastifyReply>(reply)
    const statusCode = await Promise.resolve(504)
    reply.statusCode = statusCode
    throw new Error('timed out')
  }
})
app.register(FastifyCircuitBreaker, {
  onTimeout: (req, reply) => {
    expectType<FastifyRequest>(req)
    expectType<FastifyReply>(reply)
    reply.statusCode = 504
    return 'timed out'
  }
})
app.register(FastifyCircuitBreaker, {
  onTimeout: async (req, reply) => {
    expectType<FastifyRequest>(req)
    expectType<FastifyReply>(reply)
    reply.statusCode = 504
    return 'timed out'
  }
})

app.register(FastifyCircuitBreaker, { circuitOpenErrorMessage: 'circus open' })
app.register(FastifyCircuitBreaker, {
  onCircuitOpen: async (req, reply) => {
    expectType<FastifyRequest>(req)
    expectType<FastifyReply>(reply)
    const statusCode = await Promise.resolve(504)
    reply.statusCode = statusCode
    throw new Error('circuit open')
  }
})
app.register(FastifyCircuitBreaker, {
  onCircuitOpen: (req, reply) => {
    expectType<FastifyRequest>(req)
    expectType<FastifyReply>(reply)
    reply.statusCode = 504
    return 'circuit open'
  }
})
app.register(FastifyCircuitBreaker, {
  onCircuitOpen: async (req, reply) => {
    expectType<FastifyRequest>(req)
    expectType<FastifyReply>(reply)
    reply.statusCode = 504
    return 'circuit open'
  }
})
