<img align="right" width="350" height="auto" src="https://martinfowler.com/bliki/images/circuitBreaker/state.png">

# @fastify/circuit-breaker

[![CI](https://github.com/fastify/fastify-circuit-breaker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fastify/fastify-circuit-breaker/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/@fastify/circuit-breaker.svg?style=flat)](https://www.npmjs.com/package/@fastify/circuit-breaker)
[![neostandard javascript style](https://img.shields.io/badge/code_style-neostandard-brightgreen?style=flat)](https://github.com/neostandard/neostandard)

A low overhead [circuit breaker](https://martinfowler.com/bliki/CircuitBreaker.html) for your routes.

## Install
```
npm i @fastify/circuit-breaker
```

### Compatibility
| Plugin version | Fastify version |
| ---------------|-----------------|
| `^4.x`         | `^5.x`          |
| `^3.x`         | `^4.x`          |
| `^1.x`         | `^3.x`          |
| `^0.x`         | `^2.x`          |
| `^0.x`         | `^1.x`          |


Please note that if a Fastify version is out of support, then so are the corresponding versions of this plugin
in the table above.
See [Fastify's LTS policy](https://github.com/fastify/fastify/blob/main/docs/Reference/LTS.md) for more details.

## Usage
Register the plugin and, if needed, pass it custom options.<br>
This plugin will add an `onSend` hook and expose a `circuitBreaker` utility.<br>
Call `fastify.circuitBreaker()` when declaring the `preHandler` option of a route, in this way you will put that very specific route under the *circuit breaking* check.
```js
const fastify = require('fastify')()

fastify.register(require('@fastify/circuit-breaker'))

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
    preHandler: instance.circuitBreaker(),
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

fastify.listen({ port: 3000 }, err => {
  if (err) throw err
  console.log('Server listening at http://localhost:3000')
})
```

### Options
You can pass the following options during the plugin registration, this way the values will be used in all routes.
```js
fastify.register(require('@fastify/circuit-breaker'), {
  threshold: 3, // default 5
  timeout: 5000, // default 10000
  resetTimeout: 5000, // default 10000
  onCircuitOpen: async (req, reply) => {
    reply.statusCode = 500
    throw new Error('a custom error')
  },
  onTimeout: async (req, reply) => {
    reply.statusCode = 504
    return 'timed out'
  }
})
```
- `threshold`: the maximum number of failures accepted before opening the circuit.
- `timeout:` the maximum number of milliseconds you can wait before returning a `TimeoutError`.
- `resetTimeout`: number of milliseconds before the circuit will move from `open` to `half-open`
- `onCircuitOpen`: async function that gets called when the circuit is `open` due to errors. It can modify the reply and return a `string` | `Buffer` | `Stream` payload.  If an `Error` is thrown it will be routed to your error handler.
- `onTimeout`: async function that gets called when the circuit is `open` due to timeouts.  It can modify the reply and return a `string` | `Buffer` | `Stream` | `Error` payload.  If an `Error` is thrown it will be routed to your error handler.

Otherwise, you can customize every single route by passing the same options to the `circuitBreaker` utility:
```js
fastify.circuitBreaker({
  threshold: 3, // default 5
  timeout: 5000, // default 10000
  resetTimeout: 5000 // default 10000
})
```
If you pass the options directly to the utility, it will take precedence over the global configuration.

### Customize error messages
If needed you can change the default error message for the *circuit open error* and the *timeout error*:
```js
fastify.register(require('@fastify/circuit-breaker'), {
  timeoutErrorMessage: 'Ronf...', // default 'Timeout'
  circuitOpenErrorMessage: 'Oh gosh!' // default 'Circuit open'
})
```

## Caveats
Since it is not possible to apply the classic timeout feature of the pattern, in this case the timeout will measure the time that the route takes to execute and **once the route has finished** if the time taken is higher than the timeout it will return an error, even if the route has produced a successful response.

If you need a classic circuit breaker to wrap around an API call consider using [`easy-breaker`](https://github.com/delvedor/easy-breaker).

## Acknowledgments
Image courtesy of [Martin Fowler](https://martinfowler.com/bliki/CircuitBreaker.html).

<a name="license"></a>
## License

Licensed under [MIT](./LICENSE).

