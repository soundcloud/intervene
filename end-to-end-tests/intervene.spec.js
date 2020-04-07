const REAL_EXTERNAL_HOST = 'https://intervene-test.bruderstein.now.sh';

const defaultOptions = {
  redirect: 'follow',
  credentials: 'include'
};

function request(options) {
  if (typeof options === 'string') {
    options = { url: options };
  }
  options = { ...defaultOptions, ...options };
  options.url = REAL_EXTERNAL_HOST + options.url;
  return fetch(options.url, options)
    .then((res) => {
      const headers = {};
      for (let headerName of res.headers.keys()) {
        const headerValue = res.headers.get(headerName);
        headers[headerName] = headerValue;
      }
      return res.arrayBuffer().then((buffer) => ({
        statusCode: res.status,
        statusText: res.statusText,
        headers,
        rawResponse: buffer
      }));
    })
    .then((res) => {
      const contentTypeHeader = res.headers['content-type'];
      let encoding = 'utf-8';
      if (contentTypeHeader) {
        let [contentType, charset] = contentTypeHeader
          .split(';')
          .map((p) => p.trim());
        if (charset && charset.startsWith('charset=')) {
          encoding = charset.substr('charset='.length);
        }
        res.contentType = contentType;
      }
      const decoder = new TextDecoder(encoding);
      try {
        res.text = decoder.decode(res.rawResponse);
      } catch (e) {
        res.text = undefined;
      }

      if (res.text) {
        try {
          res.data = JSON.parse(res.text);
        } catch (e) {
          res.data = undefined;
        }
      }
      return res;
    });
}

expect.addType({
  name: 'DataView',
  identify: (value) => value instanceof DataView
});

expect.addAssertion('<DataView> to equal <DataView>', function(
  expect,
  subject,
  value
) {
  const subjectArray = [];
  for (let i = 0; i < subject.byteLength; i++) {
    subjectArray.push(subject.getUint8(i));
  }
  const valueArray = [];
  for (let i = 0; i < value.byteLength; i++) {
    valueArray.push(value.getUint8(i));
  }
  expect(subjectArray, 'to equal', valueArray);
});

describe('intervene', () => {
  it('responds with the real response to a passthrough request', () => {
    return request('/api/passthrough').then((res) => {
      expect(res.data, 'to satisfy', { passthrough: true });
    });
  });

  it('returns static json directly', () => {
    return request('/api/directjson').then((res) => {
      expect(res.data, 'to satisfy', { no: 'method', just: 'json' });
    });
  });

  it('passes through the query string', () => {
    return request('/api/query?q=foo').then((res) => {
      expect(res.data, 'to satisfy', { query: 'foo' });
    });
  });

  it('modifies a response by modifying JSON body data', () => {
    return request('/api/simple').then((res) => {
      expect(res.data, 'to satisfy', {
        simple: 'result',
        number: 42,
        extra: 'added by proxy'
      });
    });
  });

  it('returns a redirect via the passthrough', () => {
    // Note that due to browser security limitations, we can't see that this has been redirected in the browser
    // (and not simply followed on the server and returning us the result of the redirected request)
    // It's possible to see in the devtools if necessary that this is working properly though
    return request('/api/redirect1').then((res) => {
      expect(res, 'to satisfy', {
        data: {
          redirected: 'target1'
        }
      });
    });
  });

  it('can change the request url before proxying', () => {
    return request('/api/change-url').then((res) => {
      expect(res, 'to satisfy', {
        data: {
          simple: 'result',
          number: 42
        }
      });
    });
  });

  it('overrides the text response for a json request', () => {
    return request('/api/simple2').then((res) => {
      expect(res, 'to satisfy', {
        data: {
          different: 'json',
          number: 42
        }
      });
    });
  });

  it('can override the status code from the proxy response', () => {
    return request('/api/simple401').then((res) => {
      expect(res, 'to satisfy', {
        statusCode: 401,
        data: { simple: 'result' }
      });
    });
  });

  it('can return a 401 status without the proxy', () => {
    return request('/api/only401').then((res) => {
      expect(res, 'to satisfy', {
        statusCode: 401,
        data: { from: 'proxy' }
      });
    });
  });

  it('can proxy binary images', () => {
    return request('/images/sample.jpg').then((res) => {
      return fetch('/end-to-end-tests/sample.jpg')
        .then((reference) => reference.arrayBuffer())
        .then((reference) => {
          const proxied = new DataView(res.rawResponse);
          const ref = new DataView(reference);
          expect(proxied, 'to equal', ref);
        });
    });
  });

  it('can return a binary image result directly', () => {
    return request('/images/tinydirect.png').then((res) => {
      return fetch('/end-to-end-tests/tiny.png')
        .then((reference) => reference.arrayBuffer())
        .then((reference) => {
          const proxied = new DataView(res.rawResponse);
          const ref = new DataView(reference);
          expect(proxied, 'to equal', ref);
          expect(res.contentType, 'to equal', 'image/png');
        });
    });
  });

  it('can override a binary image result', () => {
    return request('/images/tiny-overwritten.png').then((res) => {
      return fetch('/end-to-end-tests/tiny.png')
        .then((reference) => reference.arrayBuffer())
        .then((reference) => {
          const proxied = new DataView(res.rawResponse);
          const ref = new DataView(reference);
          expect(proxied, 'to equal', ref);
          expect(res.contentType, 'to equal', 'image/png');
        });
    });
  });

  it('can add an extra request header', () => {
    return request('/api/proxy-add-header', (res) => {
      expect(res.data, 'to satisfy', { 'x-added-by-proxy': 'foobar' });
    });
  });

  it('can add an extra response header', () => {
    return request('/api/proxy-add-response-header').then((res) => {
      expect(
        res.headers['x-added-by-proxy'],
        'to equal',
        'foo-response-header'
      );
    });
  });

  it('proxies a POST body by default', () => {
    return request({
      method: 'POST',
      url: '/api/post',
      body: JSON.stringify({ this: 'post', has: 'data' })
    }).then((res) => {
      expect(res.data, 'to satisfy', {
        post: true,
        postedBody: {
          this: 'post',
          has: 'data'
        }
      });
    });
  });

  it('can modify a POST body before proxying', () => {
    return request({
      method: 'POST',
      url: '/api/post-modify',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ this: 'post', has: 'data' })
    }).then((res) => {
      expect(res.data, 'to satisfy', {
        post: true,
        postedBody: {
          this: 'post',
          has: 'data changed by the proxy'
        }
      });
    });
  });

  it('can change the target host before proxying', () => {
    return request({
      method: 'GET',
      url: '/change-target'
    })
      .then((res) => {
        return new Promise((resolve) => {
          const typedArray = new Uint8Array(res.rawResponse);
          const img = new Image();
          img.src =
            'data:image/jpeg;base64,' +
            btoa(String.fromCharCode.apply(null, typedArray));
          img.onload = () => resolve(img);
        });
      })
      .then((img) => {
        expect(img, 'to satisfy', { width: 50, height: 50 });
      });
  });

  it('can proxy non utf-8 character sets', () => {
    // Skipping this as this isn't working yet
    return request('/api/non-utf8').then((res) => {
      expect(res.text, 'to equal', '€10');
    });
  });

  it('can proxy transfer-encoding:chunked endpoints', () => {
    return request('/api/chunked').then((res) => {
      expect(res.data, 'to equal', {
        start: 'of the data',
        end: 'of the data'
      });
    });
  });
  it('can proxy gzipped endpoints', () => {
    return request('/api/gzipped').then((res) => {
      expect(res.data, 'to equal', { foo: 'gzipped' });
    });
  });

  it('can proxy deflate endpoints', () => {
    return request('/api/deflated').then((res) => {
      expect(res.data, 'to equal', { foo: 'deflated' });
    });
  });

  it('can proxy brotli endpoints', () => {
    return request('/api/brotli').then((res) => {
      expect(res.data, 'to satisfy', { foo: 'brotli' });
    });
  });
});
