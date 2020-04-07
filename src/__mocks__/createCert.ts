export default jest.fn(function createCertificate(attrs) {
  return Promise.resolve({
    cert: Buffer.from('dummy cert'),
    key: Buffer.from('dummy key')
  });
});
