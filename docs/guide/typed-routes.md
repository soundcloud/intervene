You may want to use `intervene` to have a discussion around the data exchange format between backend and client (whilst mocking the backend so that the client can be built).

To do this, you may want to describe the shape of the request and/or the response.

### Enter `routeBuilder`

You can import `routeBuilder` in the same way from the project. It is a function which takes up to 3 type parameters, `RequestT`, `ResponseT` and `ProxyResponseT`, and a single argument of either the response or the response handler function (so everything you can put against a route).

Examples:

```typescript
import { ProxyConfig, routeBuilder } from 'intervene';

interface NewTweet {
  text: string;
  source: 'web' | 'android' | 'ios';
}

// A CreatedTweet is the same as a NewTweet, but with an id
interface CreatedTweet extends NewTweet {
  id: string;
}

// A BackendTweet is the same as a CreatedTweet, but with uid as a number
// (Scenario here is to change a frontend to use `id` as a string instead of `uid` as a number)
interface BackendTweet extends NewTweet {
  uid: number;
}

const config: ProxyConfig = {
  target: 'https://api.mycompany.com',
  routes: {
    // This describes the request POST body format as a `NewPlaylist` type.
    // Note that this has no effect as we're always returning a static response
    // However, it serves as documentation for what the request body should look like
    'POST /tweet': routeBuilder<NewTweet>({ id: 'tweets:9999999999999' }),

    'POST /tweet2': routeBuilder<NewTweet>((req, h, proxy) => {
      // Here, because this is a handler method, we have typed access to the request properties
      return {
        id: 'tweets:9999999999999',
        text: req.payload.text,  // <-- all the autocomplete goodness here :)
        source: req.payload.source
      };
    }),

    // Here we're defining a response type too. We'll get errors in the console when we save the config if the response
    // deviates from what is defined
    'POST /tweet3': routeBuilder<NewTweet, CreatedTweet>((req, h, proxy) => {
      return {
        id: 'tweets:999999999999999',
        text: req.payload.text,  // <-- all the autocomplete goodness here :)
        source: req.payload.source
      };
    }),

    // Here we're just defining the response type. We'll get typescript errors if the
    // response deviates from the type. This can be useful if you're using the types to
    // form the discussion and documentation around the data exchange formats, and you
    // don't want to be returning something that isn't valid.
    'GET /tweets/999999': routeBuilder<never, CreatedTweet>({
      id: 'tweets:999999',
      text: 'foo',
      source: 'web'
    })


    // Here we're calling the real backend with the `proxy()` function, and mapping that type
    // This is useful if you're altering the backend response in some way, but want typed access
    // to both. The default type for the proxy response is the same as the ResponseT, so you only
    // need this if you are changing the shape of the data as it passes through intervene

    'GET /tweets/777777': routeBuilder<never, CreatedTweet, BackendTweet>(async (req, h, proxy) => {
      const response = await proxy();
      // response is of type BackendPlaylist
      return {
        id: 'tweets:' + (response.body.uid * 10),
        text: response.body.text,
        source: response.body.source
      };
    })
  }
}
```
