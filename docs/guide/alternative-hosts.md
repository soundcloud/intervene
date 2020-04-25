
To proxy to another host, use the `localUrl` property in the configuration file.

For example, in the case you're running a local API server on port 8080 and you want to intercept traffic to `https://api.mycompany.com` and proxy it to your local `http://localhost:8080`, you'd set the following properties

```
target: 'http://localhost:8080',
localUrl: 'https://api.mycompany.com'
```

i.e. the `target` is where traffic gets proxied to, and the `localUrl` is the host, port and protocol to listen on locally.
