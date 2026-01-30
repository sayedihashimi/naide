import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs'
import { documentDir, join } from '@tauri-apps/api/path'
import { loadConfig, saveConfig, getConfigPath, getConfigFilePath } from './fileSystem'

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
})
