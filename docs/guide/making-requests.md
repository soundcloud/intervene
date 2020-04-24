If you want to make a request to somewhere other than the target as part of a handler, for instance to call a configuration server to identify which endpoint to proxy to, you can import `httpRequest` from `intervene`

The response is a promise, resulting in the same shape as when calling `proxy()` from a route handler.


Note that you can change the host of the `url` as part of the request before you proxy, so if you only need to change the host dynamically, you can do that directly in the handler.



### `httpRequest({ requestParams })`

A function that makes an HTTP request. The response object is the same type as the `proxy()` method, so the response can be returned directly or modified and then returned. Obviously it's also possible to make a request and then return some other response as usual.
Request parameters are defined as:
```
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
```
