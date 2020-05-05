# HTTP Strict Transport Security

## Firefox

For sites with [HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security) enabled, Firefox will not allow adding an exception to allow a self signed certificate.

To work around this:

1. Visit a page of your site _without_ `intervene` running
2. Close that tab
3. Open "History", right click the page you just visited and click "Forget about this site"
4. Now start `intervene`, and you should be able to add an exception to allow a self signed certificate

`intervene` automatically strips the HSTS headers off any proxied request, so the browser won't see it as an HSTS site whilst `intervene` is running.

Once the browser sees the real server again though, it will add the site to the HSTS list again and you'll need to repeat the above process.

### Preload list

If your site is on the preload list, you can try disabling `network.stricttransportsecurity.preloadlist` from `about:config`, restarting your browser and maybe following the above procedure, but we've not had much luck with this so far. If you have tips or workarounds for this please submit them as issues or PRs to the [GitHub project](https://github.com/soundcloud/intervene)

## Chrome

For Chrome, currently (v81 at time of writing) it still trusts the certificate created and trusted by `intervene`, so there is no issue with sites with HSTS headers.
