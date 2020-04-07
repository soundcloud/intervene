jest.dontMock('node-forge');
import createCert from '../createCert';
import * as unexpected from 'unexpected';
import * as forge from 'node-forge';
const expect = unexpected.clone();

function getCertSubject(cert: Buffer) {
  const certDetails = forge.pki.certificateFromPem(cert.toString('utf-8'));
  const subject = certDetails.subject.attributes.reduce((attrs, e) => {
    attrs[e.name] = e.value;
    return attrs;
  }, {});

  return subject;
}

describe('createCert', function() {
  it('creates a certificate with just the CN attribute set', function() {
    return createCert({ CN: 'www.unittest.com' }).then(function(cert) {
      const subject = getCertSubject(cert.cert);
      expect(subject, 'to satisfy', { commonName: 'www.unittest.com' });
    });
  });

  it('creates a certificate with just the other attributes set', function() {

    return createCert({
      CN: 'www.unittest.com',
      O: 'some org',
      OU: 'org unit',
      C: 'IT',
      ST: 'some place',
      L: 'locality place'
    }).then(function(cert) {
      const subject = getCertSubject(cert.cert);
      expect(subject, 'to satisfy', {
        commonName: 'www.unittest.com',
        stateOrProvinceName: 'some place',
        localityName: 'locality place',
        organizationalUnitName: 'org unit',
        organizationName: 'some org',
        countryName: 'IT'
      });
    });
  });
});
