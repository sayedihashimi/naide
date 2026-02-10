import { describe, it, expect } from 'vitest';
import { extractProjectFilePath, getTabType } from './projectLinkUtils';

describe('extractProjectFilePath', () => {
  const customDomains = ['myapp.local', 'dev.example.com'];

  describe('localhost URLs', () => {
    it('should extract path from localhost URL', () => {
      expect(extractProjectFilePath('http://localhost:5173/src/App.tsx', [])).toBe('src/App.tsx');
    });

    it('should extract path from localhost URL with any port', () => {
      expect(extractProjectFilePath('http://localhost:3000/.prompts/features/test.md', [])).toBe('.prompts/features/test.md');
    });

    it('should extract path from https localhost URL', () => {
      expect(extractProjectFilePath('https://localhost:8080/README.md', [])).toBe('README.md');
    });

    it('should strip leading slash from path', () => {
      expect(extractProjectFilePath('http://localhost:5173//src/App.tsx', [])).toBe('src/App.tsx');
    });

    it('should handle URL-encoded characters', () => {
      expect(extractProjectFilePath('http://localhost:5173/src/my%20file.tsx', [])).toBe('src/my file.tsx');
    });

    it('should strip query string', () => {
      expect(extractProjectFilePath('http://localhost:5173/src/App.tsx?v=123', [])).toBe('src/App.tsx');
    });

    it('should strip hash', () => {
      expect(extractProjectFilePath('http://localhost:5173/src/App.tsx#line-42', [])).toBe('src/App.tsx');
    });

    it('should strip both query string and hash', () => {
      expect(extractProjectFilePath('http://localhost:5173/src/App.tsx?v=123#line-42', [])).toBe('src/App.tsx');
    });

    it('should return null for empty path', () => {
      expect(extractProjectFilePath('http://localhost:5173/', [])).toBe(null);
    });

    it('should return null for just slashes', () => {
      expect(extractProjectFilePath('http://localhost:5173///', [])).toBe(null);
    });
  });

  describe('127.0.0.1 URLs', () => {
    it('should extract path from 127.0.0.1 URL', () => {
      expect(extractProjectFilePath('http://127.0.0.1:5173/src/App.tsx', [])).toBe('src/App.tsx');
    });

    it('should extract path from https 127.0.0.1 URL', () => {
      expect(extractProjectFilePath('https://127.0.0.1:8080/README.md', [])).toBe('README.md');
    });
  });

  describe('custom domain URLs', () => {
    it('should extract path from custom domain URL', () => {
      expect(extractProjectFilePath('http://myapp.local/src/App.tsx', customDomains)).toBe('src/App.tsx');
    });

    it('should extract path from another custom domain', () => {
      expect(extractProjectFilePath('https://dev.example.com/.prompts/features/test.md', customDomains)).toBe('.prompts/features/test.md');
    });

    it('should match custom domains case-insensitively', () => {
      expect(extractProjectFilePath('http://MyApp.Local/src/App.tsx', customDomains)).toBe('src/App.tsx');
      expect(extractProjectFilePath('http://DEV.EXAMPLE.COM/README.md', customDomains)).toBe('README.md');
    });

    it('should not match non-custom domains', () => {
      expect(extractProjectFilePath('http://example.com/src/App.tsx', customDomains)).toBe(null);
    });
  });

  describe('relative paths', () => {
    it('should extract relative path with slash', () => {
      expect(extractProjectFilePath('src/App.tsx', [])).toBe('src/App.tsx');
    });

    it('should extract relative path with dot', () => {
      expect(extractProjectFilePath('.prompts/features/test.md', [])).toBe('.prompts/features/test.md');
    });

    it('should extract file with extension', () => {
      expect(extractProjectFilePath('README.md', [])).toBe('README.md');
    });

    it('should normalize backslashes to forward slashes', () => {
      expect(extractProjectFilePath('src\\App.tsx', [])).toBe('src/App.tsx');
    });
  });

  describe('non-project URLs', () => {
    it('should return null for external URLs', () => {
      expect(extractProjectFilePath('https://github.com/user/repo', [])).toBe(null);
    });

    it('should return null for mailto links', () => {
      expect(extractProjectFilePath('mailto:test@example.com', [])).toBe(null);
    });

    it('should return null for anchor links', () => {
      expect(extractProjectFilePath('#section', [])).toBe(null);
    });

    it('should return null for data URLs', () => {
      expect(extractProjectFilePath('data:text/plain,hello', [])).toBe(null);
    });

    it('should return null for javascript URLs', () => {
      expect(extractProjectFilePath('javascript:void(0)', [])).toBe(null);
    });
  });
});

describe('getTabType', () => {
  it('should return feature-file for .prompts/features/ paths', () => {
    expect(getTabType('.prompts/features/test.md')).toBe('feature-file');
  });

  it('should return feature-file for nested .prompts/features/ paths', () => {
    expect(getTabType('.prompts/features/subfolder/test.md')).toBe('feature-file');
  });

  it('should return project-file for src/ paths', () => {
    expect(getTabType('src/App.tsx')).toBe('project-file');
  });

  it('should return project-file for root-level files', () => {
    expect(getTabType('README.md')).toBe('project-file');
  });

  it('should return project-file for .prompts/ non-features paths', () => {
    expect(getTabType('.prompts/plan/overview.md')).toBe('project-file');
  });

  it('should handle backslashes', () => {
    expect(getTabType('.prompts\\features\\test.md')).toBe('feature-file');
  });
});

describe('extractProjectFilePath with currentFilePath (relative link resolution)', () => {
  const customDomains: string[] = [];

  describe('relative links with ./', () => {
    it('should resolve ./ link relative to current file in same directory', () => {
      const currentFile = '.prompts/features/file1.md';
      expect(extractProjectFilePath('./file2.md', customDomains, currentFile)).toBe('.prompts/features/file2.md');
    });

    it('should resolve ./ link relative to current file in nested directory', () => {
      const currentFile = '.prompts/features/subfolder/file1.md';
      expect(extractProjectFilePath('./file2.md', customDomains, currentFile)).toBe('.prompts/features/subfolder/file2.md');
    });

    it('should resolve ./ link with subdirectory', () => {
      const currentFile = '.prompts/features/file1.md';
      expect(extractProjectFilePath('./subfolder/file2.md', customDomains, currentFile)).toBe('.prompts/features/subfolder/file2.md');
    });
  });

  describe('relative links with ../', () => {
    it('should resolve ../ link to parent directory', () => {
      const currentFile = '.prompts/features/subfolder/file1.md';
      expect(extractProjectFilePath('../file2.md', customDomains, currentFile)).toBe('.prompts/features/file2.md');
    });

    it('should resolve multiple ../ to go up multiple levels', () => {
      const currentFile = '.prompts/features/subfolder/deep/file1.md';
      expect(extractProjectFilePath('../../file2.md', customDomains, currentFile)).toBe('.prompts/features/file2.md');
    });

    it('should resolve ../ with subdirectory after', () => {
      const currentFile = '.prompts/features/subfolder/file1.md';
      expect(extractProjectFilePath('../other/file2.md', customDomains, currentFile)).toBe('.prompts/features/other/file2.md');
    });
  });

  describe('relative links without currentFilePath', () => {
    it('should treat relative paths as project-root relative when no currentFilePath', () => {
      expect(extractProjectFilePath('./file.md', customDomains, null)).toBe('file.md');
      expect(extractProjectFilePath('./src/App.tsx', customDomains, undefined)).toBe('src/App.tsx');
    });
  });

  describe('non-./ or ../ relative links should remain project-root relative', () => {
    it('should not resolve relative paths that do not start with ./ or ../', () => {
      const currentFile = '.prompts/features/file1.md';
      expect(extractProjectFilePath('src/App.tsx', customDomains, currentFile)).toBe('src/App.tsx');
      expect(extractProjectFilePath('.prompts/plan/overview.md', customDomains, currentFile)).toBe('.prompts/plan/overview.md');
    });
  });

  describe('edge cases', () => {
    it('should handle . in path normalization', () => {
      const currentFile = '.prompts/features/file1.md';
      expect(extractProjectFilePath('././file2.md', customDomains, currentFile)).toBe('.prompts/features/file2.md');
    });

    it('should not go above root with too many ../', () => {
      const currentFile = '.prompts/file1.md';
      expect(extractProjectFilePath('../../../file2.md', customDomains, currentFile)).toBe('file2.md');
    });

    it('should handle backslashes in currentFilePath', () => {
      const currentFile = '.prompts\\features\\file1.md';
      expect(extractProjectFilePath('./file2.md', customDomains, currentFile)).toBe('.prompts/features/file2.md');
    });

    it('should work with real feature file scenario', () => {
      // This simulates the actual use case: clicking a link in a feature file
      const currentFile = '.prompts/features/2026-02-09-project-file-link-interception.md';
      expect(extractProjectFilePath('./2026-02-06-feature-file-tabs.md', customDomains, currentFile))
        .toBe('.prompts/features/2026-02-06-feature-file-tabs.md');
    });
  });
});
