
[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) is automatically enabled by default for all endpoints, regardless of what the target server returns.

What that means in real terms is that `OPTIONS` requests get answered by the `intervene` proxy directly, and CORS headers are added to all responses.

By default, `Access-Control-Allow-Credentials: true` header is added, meaning requests to include credentials (`{ credentials: 'include' }` option using [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)) will be allowed.

To customize the CORS handling, for example to allow extra request headers or expose response headers, use the `cors` option in the config. This maps directly to the [`cors` option from `hapi`](https://hapi.dev/api/?v=18.4.1#-routeoptionscors).

By default, this is set to
```
{
  cors: {
    credentials: true,
    maxAge: 60
  }
}
```

However, setting the `cors` option in the `intervene` config will override this value (they are _not_ merged).

Note that this setting **applies to all routes**, there is currently no way to set a different setting per route.
