import { WrappedRequest, ParsedPayloadTypes } from './ProxyConfig';
import { UrlWithParsedQuery } from 'url';

export class IncomingRequest<T extends ParsedPayloadTypes>
  implements WrappedRequest<T> {
  constructor(options) {
    this.url = options.url;
    this.method = options.method;
    this.params = options.params;
    this.headers = options.headers;
    this.overrideHeaders = options.overrideHeaders;
    this.state = options.state;

    if (Buffer.isBuffer(options.payload)) {
      this.rawPayload = options.payload;
    } else if (typeof options.payload === 'string') {
      this.textPayload = options.payload;
    } else {
      this.payload = options.payload || undefined;
    }
  }
  public method:
    | 'GET'
    | 'PUT'
    | 'POST'
    | 'PATCH'
    | 'HEAD'
    | 'OPTIONS'
    | 'DELETE'
    | 'CONNECT';
  public url: UrlWithParsedQuery;
  public params: { [key: string]: string };
  public headers: { [name: string]: string | string[] };
  public overrideHeaders: { [name: string]: string };
  public state: { [key: string]: string };

  public get payload() {
    return this._payload;
  }

  public set payload(payload: T) {
    this._payload = payload;
    this._payloadInUse = 'data';
  }

  public get textPayload() {
    return this._textPayload;
  }

  public set textPayload(text: string) {
    this._textPayload = text;
    this._payloadInUse = 'text';
  }

  public get rawPayload() {
    return this._rawPayload;
  }

  public set rawPayload(rawPayload: Buffer) {
    this._rawPayload = rawPayload;
    this._payloadInUse = 'raw';
  }

  public getCalculatedRawPayload(): Buffer {
    switch (this._payloadInUse) {
      case 'data':
        if (this._payload === undefined || this._payload === null) {
          return Buffer.from([]);
        } else {
          return Buffer.from(JSON.stringify(this._payload), 'utf-8');
        }
      case 'text':
        return Buffer.from(this._textPayload, 'utf-8');
      case 'raw':
        return this._rawPayload;
    }
  }
  private _payload: T;
  private _textPayload: string;
  private _rawPayload: Buffer;
  private _payloadInUse: 'data' | 'text' | 'raw';
}
