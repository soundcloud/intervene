HTTPS TLS certificates are automatically generated, signed, and trusted (for Chrome / Safari) when required. They are valid for 7 days and stored in ~/.dev-ssl-certs.

If when starting a proxy there is less than 24 hours validity left, the certificate is untrusted, deleted and re-created with another 7 days validity.

The command `generate-cert` allows for generating a self-signed cert.  The certificate and key are generated in the current directory and is _NOT_ automatically trusted.

e.g. `intervene generate-cert local.mycompany.test --notafter 2019-10-23` creates a certificate that is valid from 1 hour ago until 23rd October 2019, for the domain local.mycompany.test.
