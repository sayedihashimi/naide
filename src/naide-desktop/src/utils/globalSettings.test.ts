import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { saveLastProject, loadLastProject, clearLastProject, getSettingsFilePath } from './globalSettings'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('globalSettings utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveLastProject', () => {
    it('should invoke save_last_project command with path', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined)
      
      await saveLastProject('/path/to/project')
      
      expect(invoke).toHaveBeenCalledWith('save_last_project', { path: '/path/to/project' })
    })

    it('should handle errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(invoke).mockRejectedValue(new Error('Save failed'))
      
      // Should not throw
      await expect(saveLastProject('/path/to/project')).resolves.not.toThrow()
      
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('loadLastProject', () => {
    it('should return project path when valid last project exists', async () => {
      vi.mocked(invoke).mockResolvedValue('/path/to/project')
      
      const result = await loadLastProject()
      
      expect(invoke).toHaveBeenCalledWith('load_last_project')
      expect(result).toBe('/path/to/project')
    })

    it('should return null when no last project exists', async () => {
      vi.mocked(invoke).mockResolvedValue(null)
      
      const result = await loadLastProject()
      
      expect(result).toBeNull()
    })

    it('should return null on error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(invoke).mockRejectedValue(new Error('Load failed'))
      
      const result = await loadLastProject()
      
      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('clearLastProject', () => {
    it('should invoke clear_last_project command', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined)
      
      await clearLastProject()
      
      expect(invoke).toHaveBeenCalledWith('clear_last_project')
    })

    it('should handle errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(invoke).mockRejectedValue(new Error('Clear failed'))
      
      // Should not throw
      await expect(clearLastProject()).resolves.not.toThrow()
      
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('getSettingsFilePath', () => {
    it('should return the settings file path', async () => {
      vi.mocked(invoke).mockResolvedValue('C:\\Users\\test\\AppData\\Roaming\\com.naide.desktop\\naide-settings.json')
      
      const result = await getSettingsFilePath()
      
      expect(invoke).toHaveBeenCalledWith('get_settings_file_path')
      expect(result).toBe('C:\\Users\\test\\AppData\\Roaming\\com.naide.desktop\\naide-settings.json')
    })

    it('should return null on error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(invoke).mockRejectedValue(new Error('Path error'))
      
      const result = await getSettingsFilePath()
      
      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })
})
