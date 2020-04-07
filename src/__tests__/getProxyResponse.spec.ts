import { IncomingRequest } from './../IncomingRequest';
jest.mock('../httpRequest');
jest.mock('../dnsLookup');
jest.dontMock('../getProxyResponse');
import { getProxyResponse } from '../getProxyResponse';
import { getIPForHost as getIPForHostMock } from '../dnsLookup';

import * as unexpected from 'unexpected';
import * as url from 'url';
import { httpRequest as httpRequestMock } from '../httpRequest';

const httpRequest: jest.Mock = (httpRequestMock as unknown) as jest.Mock;
const getIPForHost: jest.Mock = (getIPForHostMock as unknown) as jest.Mock;

const expect = unexpected.clone();

describe('getProxyResponse', () => {
  let response;
  describe('with a basic fetch', () => {
    beforeEach(() => {
      httpRequest.mockClear();
      getIPForHost.mockResolvedValue(['10.10.10.10']);
      httpRequest.mockResolvedValue({
        statusCode: 200,
        headers: {
          'strict-transport-security': 'max-age=86400'
        }
      });
      return getProxyResponse(
        {
          target: 'http://foo.test/',
          skipEtcHosts: true,
          removeStrictTransportSecurity: true
        },
        new IncomingRequest({
          method: 'POST',
          url: url.parse('http://foo.test/bar/blah', true),
          params: {},
          headers: {
            'content-length': '13',
            'content-encoding': 'gzip',
            'x-random-header': 'foo',
            'x-forwarded-proto': 'http'
          },
          overrideHeaders: {
            'x-forwarded-proto': 'https'
          },
          payload: Buffer.from(JSON.stringify({ json: true }))
        })
      ).then((res) => {
        response = res;
      });
    });

    it('makes call to httpRequest with resolved IP', () => {
      expect(httpRequest.mock.calls, 'to satisfy', [
        [
          {
            method: 'POST',
            url: 'http://10.10.10.10/bar/blah',
            payload: Buffer.from(JSON.stringify({ json: true })),
            headers: { host: 'foo.test' }
          }
        ]
      ]);
    });

    it('drops content-length header', () => {
      expect(httpRequest.mock.calls, 'to satisfy', [
        [
          {
            headers: { 'content-length': undefined }
          }
        ]
      ]);
    });

    it('drops content-encoding header', () => {
      expect(httpRequest.mock.calls, 'to satisfy', [
        [
          {
            headers: { 'content-encoding': undefined }
          }
        ]
      ]);
    });

    it('keeps extra request headers', () => {
      expect(httpRequest.mock.calls, 'to satisfy', [
        [
          {
            headers: { 'x-random-header': 'foo' }
          }
        ]
      ]);
    });

    it('includes the override headers over the main headers', () => {
      expect(httpRequest.mock.calls, 'to satisfy', [
        [
          {
            headers: { 'x-forwarded-proto': 'https' }
          }
        ]
      ]);
    });

    it('allows invalid certificates based on config', () => {
      expect(httpRequest.mock.calls, 'to satisfy', [
        [
          {
            rejectUnauthorized: true
          }
        ]
      ]);
    });
  });
  
  describe('with a config to leave STS headers alone', () => {
    beforeEach(() => {
      httpRequest.mockClear();
      getIPForHost.mockResolvedValue(['10.10.10.10']);
      httpRequest.mockResolvedValue({
        statusCode: 200,
        headers: {
          'strict-transport-security': 'max-age=86400'
        }
      });
      return getProxyResponse(
        {
          target: 'http://foo.test/',
          skipEtcHosts: true,
          removeStrictTransportSecurity: false
        },
        new IncomingRequest({
          method: 'POST',
          url: url.parse('http://foo.test/bar/blah', true),
          params: {},
          headers: {
            'content-length': '13',
            'content-encoding': 'gzip',
            'x-random-header': 'foo',
            'x-forwarded-proto': 'http'
          },
          overrideHeaders: {
            'x-forwarded-proto': 'https'
          },
          payload: Buffer.from(JSON.stringify({ json: true }))
        })
      ).then((res) => {
        response = res;
      });
    });

    it('does not strip the strict-transport-security header', () => {
      expect(response.headers, 'to satisfy', {
        'strict-transport-security': 'max-age=86400'
      });
    });
  });
});
