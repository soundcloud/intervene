To slow down a response, you could return a promise from a handler that resolves only after a given delay, but it's such a common thing to do, `intervene` exports a helper makes this easy.

Just `import { delay } from 'intervene';` and wrap your handler or response with `delay(msDelay, response)`, where `msDelay` is the millisecond delay you want, and `response` is either the JSON or plain text response or the handler.

### Example

```typescript
import { ProxyConfig, delay } from 'intervene';

const config: ProxyConfig = {
  target: 'https://api.myserver.com',
  routes: {
    '/cats/123': delay(1500, { name: 'tiddles', age: 7 })
  }
}
```
