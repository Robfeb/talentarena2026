import { App } from './app';

describe('App', () => {
  let app: any;

  const mockSession = {
    ID: 1,
    date: '2026-03-02',
    start: '10:00',
    end: '11:00',
    stage: 'Main Stage',
    speaker: 'Jane O\'Connor',
    role: 'Engineer',
    title: 'Intro to C++ & Rust',
    category: 'Dev & Ops',
    language: 'English',
  };

  beforeEach(() => {
    spyOn(globalThis, 'fetch').and.returnValue(Promise.resolve(new Response('[]', { status: 200 })));
    app = new App();
  });

  describe('matchesSearchText', () => {
    it('should return true when search text is empty', () => {
      app.searchText.set('');
      expect(app.matchesSearchText(mockSession)).toBeTrue();
    });

    it('should return true when search text has only whitespace', () => {
      app.searchText.set('   ');
      expect(app.matchesSearchText(mockSession)).toBeTrue();
    });

    it('should handle special characters in search text', () => {
      app.searchText.set('C++');
      expect(app.matchesSearchText(mockSession)).toBeTrue();

      app.searchText.set('O\'Connor');
      expect(app.matchesSearchText(mockSession)).toBeTrue();

      app.searchText.set('& Ops');
      expect(app.matchesSearchText(mockSession)).toBeTrue();
    });

    it('should handle regex-like characters literally without breaking', () => {
      app.searchText.set('.*+?^${}()|[]');
      expect(app.matchesSearchText(mockSession)).toBeFalse();

      const sessionWithRegexChars = {
        ...mockSession,
        title: 'Learn .*+?^${}()|[] Here'
      };
      expect(app.matchesSearchText(sessionWithRegexChars)).toBeTrue();
    });

    it('should ignore leading and trailing spaces around special characters', () => {
      app.searchText.set('  C++  ');
      expect(app.matchesSearchText(mockSession)).toBeTrue();
    });

    it('should be case-insensitive with special characters', () => {
      app.searchText.set('o\'connor');
      expect(app.matchesSearchText(mockSession)).toBeTrue();

      app.searchText.set('c++');
      expect(app.matchesSearchText(mockSession)).toBeTrue();
    });

    it('should return false when special characters do not match payload', () => {
      app.searchText.set('C#');
      expect(app.matchesSearchText(mockSession)).toBeFalse();

      app.searchText.set('O"Connor'); // Double quote instead of single quote
      expect(app.matchesSearchText(mockSession)).toBeFalse();
    });
  });
});
