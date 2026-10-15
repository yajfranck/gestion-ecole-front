import { describePermission, DOCUMENTED_PERMISSION_CODES } from './permission-description';

describe('permission descriptions', () => {
  it('provides a French description for every documented permission code', () => {
    expect(DOCUMENTED_PERMISSION_CODES.length).toBe(44);
    for (const code of DOCUMENTED_PERMISSION_CODES) {
      expect(describePermission({ code, description: 'API fallback' })).not.toBe('API fallback');
    }
  });

  it('uses the API description for a permission not yet documented by the frontend', () => {
    expect(describePermission({ code: 'future_permission', description: 'Future permission' }))
      .toBe('Future permission');
  });
});