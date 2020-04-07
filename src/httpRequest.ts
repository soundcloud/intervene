import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import { ProxyResponse, ReturnTypes } from './ProxyConfig';
import { createGunzip, createInflate } from 'zlib';
import brotliDecompress from './brotli-decode';
import { log } from './logger';
import * as iconv from 'iconv-lite';

interface HttpRequester {
  request(
    options: https.RequestOptions,
    callback?: (res: http.IncomingMessage) => void
  ): http.ClientRequest;
}
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

export function httpRequest<T extends ReturnTypes>(request: {
  method?:
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'HEAD'
    | 'OPTIONS'
    | 'PATCH'
    | 'CONNECT';
  url: string;
  headers?: { [key: string]: string | string[] | undefined };
  hostname?: string;
  payload?: Buffer;
  rejectUnauthorized?: boolean;
}): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const requestUrl = url.parse(request.url, false);
    const isHttps = requestUrl.protocol === 'https:';

    let requestOptions = {
      method: request.method || 'GET',
      headers: request.headers,
      servername: request.hostname,
      agent: isHttps ? httpsAgent : httpAgent,
      rejectUnauthorized:
        request.rejectUnauthorized !== undefined && isHttps
          ? request.rejectUnauthorized
          : true,
      ...requestUrl
    };

    const req = ((isHttps ? https : http) as HttpRequester).request(
      requestOptions
    );

    req.on('error', (err: Error) => {
      log.error('Error in HTTP request (generally invalid HTTP): ' + err);
      if (err.stack) {
        log.error('Stack: ' + err.stack);
      }
    });

    req.on('response', (res) => {
      const response = new HttpResponse<T>(res);
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk, response.encoding));
        } else {
          chunks.push(chunk);
        }
      });

      res.on('error', (e) => {
        log.info('ERROR in httpRequest - in on(error) handler on res');
        reject(e);
      });

      res.on('end', () => {
        const rawResponse = Buffer.concat(chunks);
        response.setResponseBody(rawResponse).then(() => {
          resolve(response);
        });
      });
    });

    const payload: Buffer | undefined =
      Buffer.isBuffer(request.payload) && request.payload.length > 0
        ? request.payload
        : undefined;
    req.end(payload);
  });
}

/** This is the required parts of the IncomingMessage, to allow for easier mocking */
interface RequiredIncomingMessage {
  headers: {
    'content-type';
    [key: string]: string | string[] | undefined;
  };
  statusCode: number;
  statusMessage: string;
}

export class HttpResponse<T extends ReturnTypes> implements ProxyResponse<T> {
  constructor(res: RequiredIncomingMessage) {
    const contentTypeHeader = res.headers['content-type'];
    this.encoding = 'utf-8';
    let contentType, encodingHeader;
    if (contentTypeHeader) {
      [contentType, encodingHeader] = contentTypeHeader
        .split(';')
        .map((item) => item && item.trim());
      if (
        encodingHeader &&
        encodingHeader.toLowerCase().startsWith('charset=')
      ) {
        encodingHeader = encodingHeader.substr('charset='.length);
      }
      this.encoding = (encodingHeader || 'utf-8').toLowerCase();
    }
    const contentEncoding = res.headers['content-encoding'];
    if (typeof contentEncoding === 'string') {
      this.contentEncoding = contentEncoding;
    }
    this.contentType = contentType || '';
    this.headers = res.headers;
    this.statusCode = res.statusCode || 0;
    this.statusMessage = res.statusMessage || '';
  }

  setResponseBody(rawResponse: Buffer) {
    this._responseTypeInUse = 'raw';

    return new Promise((resolve) => {
      if (this.contentEncoding) {
        switch (this.contentEncoding) {
          case 'gzip':
          case 'deflate':
            const decompressor =
              this.contentEncoding === 'gzip'
                ? createGunzip()
                : createInflate();
            const chunks: Buffer[] = [];
            decompressor.on('data', (chunk) => {
              if (typeof chunk === 'string') {
                chunk = Buffer.from(chunk, this.encoding);
              }
              chunks.push(chunk);
            });
            decompressor.on('end', () => {
              resolve(Buffer.concat(chunks));
            });
            decompressor.end(rawResponse);
            break;
          case 'br':
            resolve(Buffer.from(brotliDecompress(rawResponse) as Buffer));
            break;
          default:
            resolve(rawResponse);
            break;
        }
      } else {
        resolve(rawResponse);
      }
    }).then((rawResponse: Buffer) => {
      this._rawResponse = rawResponse;

      let text;
      if (this.encoding === 'utf-8' || this.encoding === 'utf8') {
        text = rawResponse.toString(this.encoding);
      } else if (iconv.encodingExists(this.encoding)) {
        text = iconv.decode(rawResponse, this.encoding);
      } else {
        text = undefined;
      }

      let body: T | undefined = undefined;
      try {
        body = JSON.parse(text);
        this._responseTypeInUse = 'body';
      } catch {
        body = undefined;
      }

      // This is a hack so that in proxy configs, if you've typed your response, you don't need to check
      // that it's actually not undefined first. It could be, if (for example) the JSON is parsable,
      // but if that's the case, we'll just get a runtime error trying to "do stuff" with `body`,
      // which is probably fine in that case.
      this._body = body as T;
      this._text = text;
    });
  }

  private _responseTypeInUse: 'body' | 'text' | 'raw';
  public get body(): any {
    return this._body;
  }

  public set body(body: any) {
    this._body = body;
    this._responseTypeInUse = 'body';
  }

  public get text() {
    return this._text;
  }

  public set text(text: string) {
    this._text = text;
    this._responseTypeInUse = 'text';
  }

  public get rawResponse(): Buffer {
    return this._rawResponse;
  }

  public set rawResponse(rawResponse: Buffer) {
    this._rawResponse = rawResponse;
    this._responseTypeInUse = 'raw';
  }

  private _text: string;
  private _rawResponse: Buffer;
  private _body: T;

  public encoding: string;
  public contentEncoding: string;
  public statusCode: number;
  public statusMessage: string;
  public contentType: string;
  public headers: {
    [key: string]: string | string[] | undefined;
  };

  public getCalculatedRawResponse() {
    switch (this._responseTypeInUse) {
      case 'body':
        if (this._body !== undefined) {
          if (iconv.encodingExists(this.encoding)) {
            return iconv.encode(JSON.stringify(this._body), this.encoding);
          } else {
            log.warn(
              'JSON data cannot be serialised with the required encoding `' +
                this.encoding +
                '`, using utf-8 instead.'
            );
            this.encoding = 'utf-8';
            return Buffer.from(JSON.stringify(this._body), 'utf-8');
          }
        }
        return Buffer.from([]);
      case 'text':
        if (iconv.encodingExists(this.encoding)) {
          return iconv.encode(this._text, this.encoding);
        } else {
          log.warn(
            'Text response cannot be encoded with the required encoding `' +
              this.encoding +
              '`, using utf-8 instead.'
          );
          this.encoding = 'utf-8';
          return Buffer.from(this._text, 'utf-8');
        }

      case 'raw':
        return this._rawResponse;
    }
  }
}
