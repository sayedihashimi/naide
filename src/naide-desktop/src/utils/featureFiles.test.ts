import { describe, it, expect } from 'vitest';
import { filterFeatureFiles, type FeatureFileNode } from './featureFiles';

describe('featureFiles utilities', () => {
  describe('filterFeatureFiles', () => {
    it('returns all files when query is empty', () => {
      const files: FeatureFileNode[] = [
        {
          name: 'test-feature',
          full_name: '2026-02-01-test-feature.md',
          path: '2026-02-01-test-feature.md',
          date: '2026-02-01',
          is_folder: false,
          children: null,
        },
      ];
      
      const result = filterFeatureFiles(files, '');
      expect(result).toEqual(files);
    });
    
    it('filters files by name (case-insensitive)', () => {
      const files: FeatureFileNode[] = [
        {
          name: 'add-feature',
          full_name: '2026-02-01-add-feature.md',
          path: '2026-02-01-add-feature.md',
          date: '2026-02-01',
          is_folder: false,
          children: null,
        },
        {
          name: 'fix-bug',
          full_name: '2026-02-01-fix-bug.md',
          path: '2026-02-01-fix-bug.md',
          date: '2026-02-01',
          is_folder: false,
          children: null,
        },
      ];
      
      const result = filterFeatureFiles(files, 'feature');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('add-feature');
    });
    
    it('filters folders and their children', () => {
      const files: FeatureFileNode[] = [
        {
          name: 'bugs',
          full_name: 'bugs',
          path: 'bugs',
          date: null,
          is_folder: true,
          children: [
            {
              name: 'fix-issue',
              full_name: '2026-02-01-fix-issue.md',
              path: 'bugs/2026-02-01-fix-issue.md',
              date: '2026-02-01',
              is_folder: false,
              children: null,
            },
            {
              name: 'add-validation',
              full_name: '2026-02-01-add-validation.md',
              path: 'bugs/2026-02-01-add-validation.md',
              date: '2026-02-01',
              is_folder: false,
              children: null,
            },
          ],
        },
      ];
      
      const result = filterFeatureFiles(files, 'fix');
      expect(result).toHaveLength(1);
      expect(result[0].is_folder).toBe(true);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].name).toBe('fix-issue');
    });
    
    it('includes folder if folder name matches', () => {
      const files: FeatureFileNode[] = [
        {
          name: 'bugs',
          full_name: 'bugs',
          path: 'bugs',
          date: null,
          is_folder: true,
          children: [
            {
              name: 'fix-issue',
              full_name: '2026-02-01-fix-issue.md',
              path: 'bugs/2026-02-01-fix-issue.md',
              date: '2026-02-01',
              is_folder: false,
              children: null,
            },
          ],
        },
      ];
      
      const result = filterFeatureFiles(files, 'bugs');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('bugs');
      // When folder name matches, children are still filtered (none match 'bugs')
      expect(result[0].children).toHaveLength(0);
    });
    
    it('returns empty array when no matches', () => {
      const files: FeatureFileNode[] = [
        {
          name: 'test-feature',
          full_name: '2026-02-01-test-feature.md',
          path: '2026-02-01-test-feature.md',
          date: '2026-02-01',
          is_folder: false,
          children: null,
        },
      ];
      
      const result = filterFeatureFiles(files, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });
});
