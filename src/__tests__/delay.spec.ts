import * as unexpected from 'unexpected';
import * as unexpectedSinon from 'unexpected-sinon';

import * as sinon from 'sinon';
import { delay } from '../delay';
import { ResponseToolkit, WrappedRequest } from 'src';

const expect = unexpected.clone().use(unexpectedSinon);

describe('delay', () => {
  let fakeTimers;
  beforeEach(() => {
    fakeTimers = sinon.useFakeTimers();
  });

  afterEach(() => {
    fakeTimers.restore();
  });

  it('responds with a promise of the response', () => {
    const payload: any = { some: 'response' };
    const handler = delay(100, payload);
    const result = handler(1 as any, 2 as any, 3 as any);
    fakeTimers.tick(100);
    return expect(result, 'to be fulfilled with', {
      some: 'response'
    });
  });

  it('responds with a handler', () => {
    const handler = sinon.spy();
    const result = delay(100, handler);
    const proxy = () => Promise.resolve({} as any);
    result(
      ({ method: 'GET' } as any) as WrappedRequest, // Just casting these as we don't care what they are
      ({ toolkit: true } as any) as ResponseToolkit,
      proxy
    );
    expect(handler, 'was not called');
    fakeTimers.tick(100);
    return expect(handler, 'to have calls satisfying', [
      [{ method: 'GET' }, { toolkit: true }, proxy]
    ]);
  });

  it('returns with the handler response', () => {
    const handler = sinon.stub().returns({ foo: 'bar' });
    const result = delay(100, handler);
    const proxy = () => Promise.resolve({} as any);
    const response = result(
      ({ method: 'GET' } as any) as WrappedRequest, // Just casting these as we don't care what they are
      ({ toolkit: true } as any) as ResponseToolkit,
      proxy
    );
    expect(handler, 'was not called');
    fakeTimers.tick(100);
    return expect(response, 'to be fulfilled with', { foo: 'bar' });
  });

  it('responds with the proxy response when no response is provided', () => {
    const handler = sinon.stub().returns({ foo: 'bar' });
    const result = delay(100);
    const proxy = () => Promise.resolve({ result: 'foo' } as any);
    const response = result(
      ({ method: 'GET' } as any) as WrappedRequest, // Just casting these as we don't care what they are
      ({ toolkit: true } as any) as ResponseToolkit,
      proxy
    );
    expect(handler, 'was not called');
    fakeTimers.tick(100);
    return expect(response, 'to be fulfilled with', { result: 'foo' });
  });
});
