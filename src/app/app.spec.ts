import { App } from './app';

describe('App', () => {
  let app: App;

  beforeEach(() => {
    // Because app instantiates global fetch which causes issues, let's mock it
    globalThis.fetch = jasmine.createSpy('fetch').and.returnValue(
      Promise.resolve(new Response(JSON.stringify([])))
    );
    app = new App();
  });

  describe('parseDate', () => {
    it('should return MAX_SAFE_INTEGER for invalid dates', () => {
      const invalidDates = ['99/99/9999', 'abc 123', '32 Feb'];
      invalidDates.forEach(date => {
        expect((app as any).parseDate(date)).toBe(Number.MAX_SAFE_INTEGER);
      });
    });

    it('should parse valid dates properly', () => {
      const parsed = (app as any).parseDate('Feb 25');
      expect(parsed).not.toBe(Number.MAX_SAFE_INTEGER);
      expect(typeof parsed).toBe('number');
      expect(Number.isNaN(parsed)).toBe(false);
    });
  });
});
