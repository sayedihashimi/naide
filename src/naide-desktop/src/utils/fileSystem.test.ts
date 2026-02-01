import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs'
import { documentDir, join } from '@tauri-apps/api/path'
import { loadConfig, saveConfig, getConfigPath, getConfigFilePath, addMarkdownFooter, formatSectionAsMarkdown } from './fileSystem'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-fs', () => ({
  create: vi.fn(),
  exists: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  documentDir: vi.fn().mockResolvedValue('/mock/documents'),
  join: vi.fn((...args) => Promise.resolve(args.join('/'))),
}))

describe('fileSystem utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getConfigPath', () => {
    it('should return correct config directory path', async () => {
      const path = await getConfigPath()
      expect(path).toBe('/mock/documents/.naide')
    })
  })

  describe('getConfigFilePath', () => {
    it('should return correct config file path', async () => {
      const path = await getConfigFilePath()
      expect(path).toBe('/mock/documents/.naide/config.json')
    })
  })

  describe('loadConfig', () => {
    it('should return default config when file does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false)
      
      const config = await loadConfig()
      
      expect(config).toEqual({
        lastUsedProject: null,
        projects: []
      })
    })

    it('should load and parse config from file', async () => {
      const mockConfig = {
        lastUsedProject: '/path/to/project',
        projects: [
          { name: 'MyApp', path: '/path/to/project', createdAt: '2024-01-01' }
        ]
      }
      
      vi.mocked(exists).mockResolvedValue(true)
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(mockConfig))
      
      const config = await loadConfig()
      
      expect(config).toEqual(mockConfig)
      expect(readTextFile).toHaveBeenCalled()
    })

    it('should return default config on error', async () => {
      vi.mocked(exists).mockRejectedValue(new Error('Read error'))
      
      const config = await loadConfig()
      
      expect(config).toEqual({
        lastUsedProject: null,
        projects: []
      })
    })
  })

  describe('saveConfig', () => {
    it('should create config directory and write config file', async () => {
      const mockConfig = {
        lastUsedProject: '/path/to/project',
        projects: [
          { name: 'MyApp', path: '/path/to/project', createdAt: '2024-01-01' }
        ]
      }
      
      // Mock exists to return false so it creates the directory
      vi.mocked(exists).mockResolvedValue(false)
      
      await saveConfig(mockConfig)
      
      expect(mkdir).toHaveBeenCalled()
      expect(writeTextFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(mockConfig, null, 2)
      )
    })
  })

  describe('addMarkdownFooter', () => {
    it('should add footer to markdown content', () => {
      const content = '# Title\n\nSome content'
      const result = addMarkdownFooter(content)
      
      expect(result).toBe('# Title\n\nSome content\n\n<!-- created by naide -->')
    })

    it('should add footer to empty content', () => {
      const content = ''
      const result = addMarkdownFooter(content)
      
      expect(result).toBe('\n\n<!-- created by naide -->')
    })

    it('should not add duplicate footer (idempotent)', () => {
      const content = '# Title\n\nSome content'
      const result1 = addMarkdownFooter(content)
      const result2 = addMarkdownFooter(result1)
      
      expect(result1).toBe(result2)
      // Count occurrences of the footer
      const footerCount = (result2.match(/<!-- created by naide -->/g) || []).length
      expect(footerCount).toBe(1)
    })
  })

  describe('formatSectionAsMarkdown', () => {
    it('should format section as markdown with footer', () => {
      const questions = [
        { id: 'question-1', question: 'What is this?', type: 'text' },
        { id: 'question-2', question: 'Why is this?', type: 'text' }
      ]
      const answers = {
        'question-1': 'This is a test',
        'question-2': 'Because we need it'
      }
      
      const result = formatSectionAsMarkdown('Test Section', questions, answers)
      
      expect(result).toContain('# Test Section')
      expect(result).toContain('## What is this?')
      expect(result).toContain('This is a test')
      expect(result).toContain('## Why is this?')
      expect(result).toContain('Because we need it')
      expect(result.endsWith('<!-- created by naide -->')).toBe(true)
    })

    it('should handle empty answers with footer', () => {
      const questions = [
        { id: 'question-1', question: 'What is this?', type: 'text' }
      ]
      const answers = {}
      
      const result = formatSectionAsMarkdown('Test Section', questions, answers)
      
      expect(result).toContain('# Test Section')
      expect(result).toContain('## What is this?')
      expect(result).toContain('_No answer provided_')
      expect(result.endsWith('<!-- created by naide -->')).toBe(true)
    })
  })
})
