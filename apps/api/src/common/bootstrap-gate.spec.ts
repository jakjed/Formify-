import {
  bootstrapStatus,
  isPublicBootstrapAllowed,
} from './bootstrap-gate';

describe('bootstrap-gate', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('is open outside production by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_PUBLIC_BOOTSTRAP;
    delete process.env.BOOTSTRAP_TOKEN;
    expect(isPublicBootstrapAllowed()).toBe(true);
    expect(bootstrapStatus().waitlist).toBe(false);
  });

  it('is closed in production without a token', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_PUBLIC_BOOTSTRAP;
    delete process.env.BOOTSTRAP_TOKEN;
    expect(isPublicBootstrapAllowed()).toBe(false);
    expect(bootstrapStatus().waitlist).toBe(true);
  });

  it('accepts a matching bootstrap token in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.BOOTSTRAP_TOKEN = 'invite-key';
    expect(isPublicBootstrapAllowed('invite-key')).toBe(true);
    expect(isPublicBootstrapAllowed('wrong')).toBe(false);
  });
});
