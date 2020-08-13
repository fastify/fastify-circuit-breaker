import {
  FastifyPlugin,
  FastifyRequest,
  FastifyReply,
  HookHandlerDoneFunction,
} from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    circuitBreaker(
      options?: FastifyCircuitBreakerOptions
    ): FastifyCircuitBreakerBeforeHandler;
  }
}

export interface FastifyCircuitBreakerBeforeHandler {
  (
    req: FastifyRequest,
    reply: FastifyReply,
    next: HookHandlerDoneFunction
  ): FastifyReply | void;
}

export type FastifyCircuitBreakerOptions = {
  /**
   * The maximum numbers of failures you accept to have before opening the circuit.
   * @default 5
   */
  threshold?: number;
  /**
   * The maximum number of milliseconds you can wait before return a `TimeoutError`.
   * @default 10000
   */
  timeout?: number;

  /**
   * The number of milliseconds before the circuit will move from `open` to `half-open`.
   * @default 10000
   */
  resetTimeout?: number;
};

export const fastifyCircuitBreaker: FastifyPlugin<FastifyCircuitBreakerOptions>;

export default fastifyCircuitBreaker;
