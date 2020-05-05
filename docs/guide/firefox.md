`intervene` does not automatically trust certificates for Firefox. Firefox uses its own trusted certificate store and does not rely on the operating system certificates, which makes it much harder to do this automatically.

It may be possible to instruct Firefox to trust a new certificate automatically, so this may change in the future.

## Workaround

When you visit a URL with `intervene` running with Firefox, you'll first be prompted that the certificate is not trusted, click "Advanced" and then "Add exception" to add the certificate to the trusted list. The certificates are only valid for 7 days, so if you run `intervene` again after 7 days, you'll be prompted again.

If there is no "Add exception" button, there may be a message about [HSTS](hsts.md). See the [HSTS](hsts.md) guide to deal with this.
