import {
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
  HookHandlerDoneFunction,
} from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    circuitBreaker(
      options?: fastifyCircuitBreaker.FastifyCircuitBreakerOptions
    ): fastifyCircuitBreaker.FastifyCircuitBreakerBeforeHandler;
  }
}

type FastifyCircuitBreaker = FastifyPluginCallback<fastifyCircuitBreaker.FastifyCircuitBreakerOptions>;

declare namespace fastifyCircuitBreaker {
  export interface FastifyCircuitBreakerBeforeHandler {
    (
      req: FastifyRequest,
      reply: FastifyReply,
      next: HookHandlerDoneFunction
    ): Promise<unknown> | void;
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
  export const fastifyCircuitBreaker: FastifyCircuitBreaker
  export { fastifyCircuitBreaker as default }
}

declare function fastifyCircuitBreaker(...params: Parameters<FastifyCircuitBreaker>): ReturnType<FastifyCircuitBreaker>
export = fastifyCircuitBreaker
