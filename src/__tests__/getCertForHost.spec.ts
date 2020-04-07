jest.mock('../promiseFs');
jest.mock('../createCert');
jest.mock('../adminRequests');
jest.mock('node-forge');
import { getCertForHost, clearLocalCertCache } from '../getCertForHost';
import * as unexpected from 'unexpected';
import promiseFsMock, { PromisifiedFs } from '../promiseFs';
import createCertificateMock from '../createCert';
import * as adminRequestsMock from '../adminRequests';
import * as forgeMock from 'node-forge';

const forge: { pki: { certificateFromPem: jest.Mock } } = forgeMock as any;

const expect = unexpected.clone();

const promiseFs = promiseFsMock as jest.Mocked<PromisifiedFs>;

interface AdminRequests {
  trustCertificate: (certFilename: string) => Promise<any>;
  untrustCertificate: (certFilename: string) => Promise<any>;
}

const adminRequests = (adminRequestsMock as any) as jest.Mocked<AdminRequests>;

const createCertificate = (createCertificateMock as unknown) as jest.Mock<
  (attrs: any) => { cert: Buffer; key: Buffer }
>;

describe('getCertForHost', () => {
  beforeEach(() => {
    promiseFs.lstatAsync.mockReset();
    promiseFs.readFileAsync.mockReset();
    promiseFs.writeFileAsync.mockReset();
    promiseFs.unlinkAsync.mockReset();
    adminRequests.trustCertificate.mockReset();
    adminRequests.untrustCertificate.mockReset();
    (forge.pki.certificateFromPem as jest.Mock).mockReset();
    createCertificate.mockClear();
    clearLocalCertCache();
  });

  describe('when no certificate exists', () => {
    beforeEach(() => {
      promiseFs.lstatAsync.mockRejectedValue(new Error('not found'));
      // The types for the mock seem to be wrong here, hence the `as any`
      promiseFs.writeFileAsync.mockReturnValue(Promise.resolve() as any);
    });

    it('calls createCert if no certificate exists', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(createCertificate.mock.calls, 'to have length', 1);
    });

    it('returns the generated certificate', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(cert, 'to equal', {
        cert: Buffer.from('dummy cert'),
        key: Buffer.from('dummy key')
      });
    });

    it('writes the certificate to disk', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(promiseFs.writeFileAsync.mock.calls[0], 'to satisfy', [
        '/tmp/dummy.test.pem',
        Buffer.from('dummy cert')
      ]);
    });
    it('writes the key to disk', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(promiseFs.writeFileAsync.mock.calls[1], 'to satisfy', [
        '/tmp/dummy.test.key',
        Buffer.from('dummy key')
      ]);
    });

    it('trusts the new certificate', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(adminRequests.trustCertificate.mock.calls[0], 'to satisfy', [
        '/tmp/dummy.test.pem'
      ]);
    });
  });

  describe('when a valid certificate already exists', () => {
    beforeEach(() => {
      promiseFs.lstatAsync.mockResolvedValue({ isFile: () => true } as any);
      promiseFs.readFileAsync.mockResolvedValueOnce(
        Buffer.from('dummy cert on disk')
      );
      promiseFs.readFileAsync.mockResolvedValueOnce(
        Buffer.from('dummy key on disk')
      );

      // Make the certificate valid
      const notBefore = new Date();
      const notAfter = new Date();
      notBefore.setDate(notBefore.getDate() - 1);
      notAfter.setDate(notAfter.getDate() + 7);
      forge.pki.certificateFromPem.mockReturnValue({
        validity: {
          notBefore,
          notAfter
        }
      });
    });

    it('returns the read certificate', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(cert, 'to satisfy', {
        cert: Buffer.from('dummy cert on disk'),
        key: Buffer.from('dummy key on disk')
      });
    });
  });

  describe('when a certificate has expired', () => {
    beforeEach(() => {
      promiseFs.lstatAsync.mockResolvedValue({ isFile: () => true } as any);
      promiseFs.readFileAsync.mockResolvedValueOnce(
        Buffer.from('dummy cert on disk')
      );
      promiseFs.readFileAsync.mockResolvedValueOnce(
        Buffer.from('dummy key on disk')
      );
      promiseFs.writeFileAsync.mockResolvedValue({} as any);

      // Make the certificate valid
      const notBefore = new Date();
      const notAfter = new Date();
      notBefore.setDate(notBefore.getDate() - 7);
      notAfter.setDate(notAfter.getDate() - 1);
      forge.pki.certificateFromPem.mockReturnValue({
        validity: {
          notBefore,
          notAfter
        }
      });
    });

    it('calls createCert to generate the new certificate', async () => {
      const cert = await getCertForHost(
        '/tmp/dummy.test.pem',
        'dummy.test',
        {}
      );
      expect(createCertificate.mock.calls, 'to have length', 1);
    });

    it('returns the new certificate', async () => {
      const cert = await getCertForHost(
        '/tmp/dummy.test.pem',
        'dummy.test',
        {}
      );
      expect(cert, 'to satisfy', {
        cert: Buffer.from('dummy cert'),
        key: Buffer.from('dummy key')
      });
    });

    it('untrusts the old certificate', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(adminRequests.untrustCertificate.mock.calls, 'to satisfy', [
        ['/tmp/dummy.test.pem']
      ]);
    });

    it('deletes the old certificate', async () => {
      const cert = await getCertForHost('/tmp', 'dummy.test', {});
      expect(promiseFs.unlinkAsync.mock.calls, 'to satisfy', [
        ['/tmp/dummy.test.pem'],
        ['/tmp/dummy.test.key']
      ]);
    });
  });
});
