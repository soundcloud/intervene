
Intervene has a handful of commands that each take options:

### `create <url>`: Create and start a new proxy
Create a proxy to api.mycompany.com

```shell
intervene create https://api.mycompany.com -e
```

This creates a sample config file (called api.mycompany.com.ts), and opens the file in your editor (`TS_EDITOR`, `VISUAL` or `EDITOR` environment variables - it's advisable that these are not console editors, as the console is also used for logging from the proxy). If your editor has typescript support, you'll get autocompletion and documentation when editing the config. The proxy is automatically started. If this is a HTTPS target, a self-signed certificate is generated and trusted as part of the startup process.

The import statement is generated from the absolute location of the module, which might be in your /usr/local/lib/node_modules directory if you've installed `intervene` globally. This is actually less of a problem that it seems (especially when sharing configurations, for instance by checking them in to your repo), as the path for the import is automatically patched when starting the proxy.  For instance, even if the import is `import { ProxyConfig } from '/foo/bar/intervene';`, it will still work even though `/foo/bar` doesn't exist, because the path gets patched to the path of the current `intervene` module before the file is imported.

Saving the config file automatically reloads it and reconfigures the proxy.

### `start <config-path>`: Start a proxy from a given config file

To start a proxy with a given config file:

```shell
intervene start my-config.ts
```

It's also possible to use config files from HTTP(s) locations,

```shell
intervene start https://gist.mycompany.com/raw/myconfig.ts
```

### `generate-cert <hostname>`: Generate a self signed certificate

Generate a self signed certificate for use outside of `intervene`. There's very few options here, it just produces a valid certificate for a domain, which is easier than finding all the right options for openssl.

Options:

* `-a` `--notafter` Date in ISO8601 (`YYYY-MM-DDTHH:MM:SSZ`) format the certificate should be valid _until_. Defaults to 7 days from the current date.
* `-b` `--notbefore` Date in ISO8601 (`YYYY-MM-DDTHH:MM:SSZ`) format the certificate should be valid _form_. Defaults to 1 hour ago.
* `-f` `--filename` Filename to write the certificate to (in PEM format). The key file will be the same file but with a `.key` extension. Defaults to `<hostname>.pem`
