import {
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
  HookHandlerDoneFunction,
} from "fastify";
import { Stream } from "node:stream";

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

    /**
     * Gets called when the circuit is `open` due to timeouts.
     * It can modify the reply and return a `string` | `Buffer` | `Stream` |
     * `Error` payload.  If an `Error` is thrown it will be routed to your error
     * handler.
     */
    onTimeout?: (request: FastifyRequest, reply: FastifyReply) => void | string | Buffer | Stream | Error | Promise<void | string | Buffer | Stream | Error>;

    /**
     *
     * @default 'Timeout'
     */
    timeoutErrorMessage?: string;

    /**
     * Gets called when the circuit is `open` due to errors.
     * It can modify the reply and return a `string` | `Buffer` | `Stream`
     * payload. If an `Error` is thrown it will be routed to your error handler.
     */
    onCircuitOpen?: (request: FastifyRequest, reply: FastifyReply) => void | string | Buffer | Stream | Promise<void | string | Buffer | Stream>;

    /**
     * @default 'Circuit open'
     */
    circuitOpenErrorMessage?: string;

    /**
     * The amount of cached requests.
     * @default 500
     */
    cache?: number;
  };
  export const fastifyCircuitBreaker: FastifyCircuitBreaker
  export { fastifyCircuitBreaker as default }
}

declare function fastifyCircuitBreaker(...params: Parameters<FastifyCircuitBreaker>): ReturnType<FastifyCircuitBreaker>
export = fastifyCircuitBreaker
