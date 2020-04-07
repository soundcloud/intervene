import { ProxyConfig, routeBuilder } from '../';
import { parseTypescript } from '../parseTypescript';
import * as path from 'path';
import * as unexpected from 'unexpected';

/**
 * These aren't real tests, they are just here for the typescript type checker to validate that
 * all the typing work correctly
 */

interface PayloadSample {
  name: string;
  age: number;
}

interface ResponseSample {
  success: boolean;
  message: string;
}

// The idea here is that the response from the real backend returns `success` as a string,
// and the proxy maps this to a boolean
interface ProxyResponseSample {
  success: string;
  message: string;
}

const expect = unexpected.clone();

expect.addAssertion(
  '<string> to be a valid configuration',
  (expect, config) => {
    try {
      parseTypescript(
        path.join(__dirname, 'config.ts'),
        `import { ProxyConfig, routeBuilder } from '../../src/ProxyConfig';
      ${config}
      export default config;`
      );
    } catch (e) {
      expect.errorMode = 'bubble';
      expect.fail({
        message: (output) => {
          return output
            .error('expected')
            .nl()
            .append(config)
            .nl()
            .error('to be a valid configuration');
        },
        diff: (output) => {
          return output.error('threw ').appendInspected(e);
        }
      });
    }
  }
);

expect.addAssertion(
  '<string> to throw type error <regexp|string|Error>',
  (expect, config, expected) => {
    let passed = false;
    try {
      parseTypescript(
        path.join(__dirname, 'config.ts'),
        `import { ProxyConfig, routeBuilder } from '../../src/ProxyConfig';
         ${config}
         export default config;`
      );
      passed = true;
    } catch (e) {
      expect.errorMode = 'nested';
      expect(
        () => {
          throw e;
        },
        'to throw',
        expected
      );
    }

    if (passed) {
      expect.errorMode = 'bubble';
      expect.fail({
        message: (output) => {
          return output
            .error('expected')
            .nl()
            .append(config)
            .nl()
            .error('to throw type error, but it passed');
        }
      });
    }
  }
);

describe('Config typings', () => {
  it('should support typing the request payload with a raw object response', () => {
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<PayloadSample>({ success: true })
      }
    };
  });

  it('should support typing the request payload with a handler func', () => {
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<PayloadSample>((req, h, proxy) => {
          // Typed access to req.payload here
          return { name: req.payload.name, age: req.payload.age };
        })
      }
    };
  });

  it('should support typing the response payload with a handler func', () => {
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<PayloadSample, ResponseSample>(
          async (req, h, proxy) => {
            const res = await proxy();

            // Typed access to res.body here
            const message = res.body.message;

            return { success: false, message: 'foo' };
          }
        )
      }
    };
  });

  it('should support typing the response payload with a pure object', () => {
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<PayloadSample, ResponseSample>({
          success: true,
          message: 'foo'
        })
      }
    };
  });

  it('should support typing the response payload with an array', () => {
    // Please don't actually create APIs that return arrays - they're really hard to change or extend later :)
    // But we need to support it. /shrug
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<PayloadSample, ResponseSample[]>([
          { success: true, message: 'foo' }
        ])
      }
    };
  });

  it('should support typing the proxy response and the response differently', () => {
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<
          PayloadSample,
          ResponseSample,
          ProxyResponseSample
        >(async (req, h, proxy) => {
          const res = await proxy();
          // Map the succes to a boolean
          const success: boolean = res.body.success === 'true';
          return { success, message: res.body.message };
        })
      }
    };
  });

  it('should support a typed response using h.response()', () => {
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'GET /foo': routeBuilder<never, ResponseSample>((req, h, proxy) => {
          // No type checking here, but we need to allow returning a 404 or something too.
          const res = h.response({ success: true, message: 'foo' });
          res.code(201);
          return res;
        })
      }
    };
  });

  it('errors when accessing properties that don`t exist in the payload', () => {
    expect(
      `
    interface Payload {
      name: string;
      age: number;
    }
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<Payload>((req, h, proxy) => {
          return {
            name: req.payload.name,
            address: req.payload.address
          };
        })
      }
    };
    `,
      'to throw type error',
      /Property 'address' does not exist on type 'Payload'/
    );
  });

  it('accepts a validly typed config', () => {
    // This test actually validates that the parser accepts the typed configs
    // The other tests that aren't really tests check that typescript itself doesn't throw
    // errors when this project is compiled. They also allow to check that editors provide
    // type support when accessing req.payload etc.
    expect(
      `
      interface Payload {
        name: string;
        age: number;
      }
      interface Response {
        success: boolean;
        message: string;
      }
      const config: ProxyConfig = {
        target: 'http://foo',
        routes: {
          'POST /foo': routeBuilder<Payload, Response>((req, h, proxy) => {

            return {
              message: req.payload.name + ':' + Math.max(req.payload.age, 18),
              success: true
            };
          })
        }
      };`,
      'to be a valid configuration'
    );
  });

  it('accepts a non typed config', () => {
    expect(
      `
      const config: ProxyConfig = {
        target: 'http://foo',
        routes: {
          'POST /foo': ((req, h, proxy) => {

            return {
              message: req.payload.name + ':' + Math.max(req.payload.age, 18),
              success: true
            };
          })
        }
      };`,
      'to be a valid configuration'
    );
  });

  it('errors when returning an object that doesn`t match the response type', () => {
    expect(
      `
    interface Response {
      name: string;
      age: number;
    }
    const config: ProxyConfig = {
      target: 'http://foo',
      routes: {
        'POST /foo': routeBuilder<any, Response>((req, h, proxy) => {
          return {
            name: 'foo',
            age: 'nineteen'
          };
        })
      }
    };
    `,
      'to throw type error',
      /is not assignable to parameter of type/
    );
  });

  it('allows the never type for a Request type on a GET', () => {
    expect(
      `
      interface Response {
        message: string;
        success: boolean;
      }
      const config: ProxyConfig = {
        target: 'http://foo',
        routes: {
          'GET /foo': routeBuilder<never, Response>((req, h, proxy) => {
            return {
              message: 'foo',
              success: true
            };
          })
        }
      };`,
      'to be a valid configuration'
    );
  });

  it('errors when accessing the never type for a Request type', () => {
    expect(
      `
      interface Response {
        message: string;
        success: boolean;
      }
      const config: ProxyConfig = {
        target: 'http://foo',
        routes: {
          'POST /foo': routeBuilder<never, Response>((req, h, proxy) => {
            return {
              message: req.payload.message,
              success: true
            };
          })
        }
      };`,
      'to throw type error',
      /Property 'message' does not exist on type 'never'/
    );
  });
});
