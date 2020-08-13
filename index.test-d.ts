import fastify from "fastify";
import FastifyCircuitBreaker, { FastifyCircuitBreakerOptions } from ".";

const app = fastify();

app.register(FastifyCircuitBreaker);
app.register(FastifyCircuitBreaker, {});
app.register(FastifyCircuitBreaker, { timeout: 5000 });
app.register(FastifyCircuitBreaker, { threshold: 5 });
app.register(FastifyCircuitBreaker, { resetTimeout: 10000 });
app.register(FastifyCircuitBreaker, {
  timeout: 5000,
  threshold: 5,
  resetTimeout: 10000,
});

const fastifyCircuitBreakerOptions: FastifyCircuitBreakerOptions = {
  timeout: 5000,
  threshold: 5,
  resetTimeout: 10000,
};
app.register(FastifyCircuitBreaker, fastifyCircuitBreakerOptions);

app.get(
  "/",
  {
    preHandler: app.circuitBreaker(),
  },
  (req, reply) => {}
);
