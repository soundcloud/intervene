export const addHostEntry = jest.fn(() =>
  Promise.resolve({ success: true, added: true })
);
export const removeHostEntry = jest.fn(() =>
  Promise.resolve({ success: true })
);

export const portProxy = jest.fn().mockResolvedValue({ success: true });
export const getPortProxies = jest.fn().mockResolvedValue({});
export const stopPortProxy = jest.fn().mockResolvedValue({ success: true });

export const trustCertificate = jest.fn().mockResolvedValue({});
export const untrustCertificate = jest.fn().mockResolvedValue({});
