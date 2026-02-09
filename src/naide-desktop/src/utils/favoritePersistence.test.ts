import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadFavoriteSessions, saveFavoriteSessions, toggleFavoriteSession } from './favoritePersistence';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
}));

const { exists, readTextFile, writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');

describe('favoritePersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadFavoriteSessions', () => {
    it('should return empty array when config does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);

      const result = await loadFavoriteSessions('/test/project');

      expect(result).toEqual([]);
    });

    it('should return empty array when config has no favoriteSessions', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
        projectName: 'test-project',
      }));

      const result = await loadFavoriteSessions('/test/project');

      expect(result).toEqual([]);
    });

    it('should return favorite sessions from config', async () => {
      const favorites = ['chat-1.json', 'chat-2.json'];
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
        projectName: 'test-project',
        favoriteSessions: favorites,
      }));

      const result = await loadFavoriteSessions('/test/project');

      expect(result).toEqual(favorites);
    });

    it('should return empty array on read error', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockRejectedValue(new Error('Read error'));

      const result = await loadFavoriteSessions('/test/project');

      expect(result).toEqual([]);
    });
  });

  describe('saveFavoriteSessions', () => {
    it('should create .naide directory if it does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);

      await saveFavoriteSessions('/test/project', ['chat-1.json']);

      expect(mkdir).toHaveBeenCalledWith('/test/project/.naide', { recursive: true });
    });

    it('should save favorites to new config file', async () => {
      vi.mocked(exists).mockResolvedValue(false);
      const favorites = ['chat-1.json', 'chat-2.json'];

      await saveFavoriteSessions('/test/project', favorites);

      expect(writeTextFile).toHaveBeenCalledWith(
        '/test/project/.naide/project-config.json',
        expect.stringContaining('"favoriteSessions"')
      );

      const writtenContent = vi.mocked(writeTextFile).mock.calls[0][1];
      const parsed = JSON.parse(writtenContent);
      expect(parsed.favoriteSessions).toEqual(favorites);
    });

    it('should merge with existing config without overwriting other fields', async () => {
      const existingConfig = {
        projectName: 'test-project',
        lastChatSession: 'chat-active.json',
        selectedApp: { app_type: 'dotnet' },
      };
      
      vi.mocked(exists).mockImplementation(async (path: string) => {
        // .naide directory exists
        if (path === '/test/project/.naide') return true;
        // config file exists
        if (path.includes('project-config.json')) return true;
        return false;
      });
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(existingConfig));

      const favorites = ['chat-1.json'];
      await saveFavoriteSessions('/test/project', favorites);

      const writtenContent = vi.mocked(writeTextFile).mock.calls[0][1];
      const parsed = JSON.parse(writtenContent);
      
      expect(parsed.projectName).toBe('test-project');
      expect(parsed.lastChatSession).toBe('chat-active.json');
      expect(parsed.selectedApp).toEqual({ app_type: 'dotnet' });
      expect(parsed.favoriteSessions).toEqual(favorites);
    });

    it('should not throw on save error', async () => {
      vi.mocked(exists).mockRejectedValue(new Error('Write error'));

      await expect(saveFavoriteSessions('/test/project', ['chat-1.json'])).resolves.not.toThrow();
    });
  });

  describe('toggleFavoriteSession', () => {
    it('should add session to favorites when not present', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
        favoriteSessions: ['chat-1.json'],
      }));

      const result = await toggleFavoriteSession('/test/project', 'chat-2.json');

      expect(result).toEqual(['chat-1.json', 'chat-2.json']);
      expect(writeTextFile).toHaveBeenCalled();
    });

    it('should remove session from favorites when present', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
        favoriteSessions: ['chat-1.json', 'chat-2.json'],
      }));

      const result = await toggleFavoriteSession('/test/project', 'chat-1.json');

      expect(result).toEqual(['chat-2.json']);
      expect(writeTextFile).toHaveBeenCalled();
    });

    it('should add first favorite to empty list', async () => {
      vi.mocked(exists).mockResolvedValue(false);

      const result = await toggleFavoriteSession('/test/project', 'chat-1.json');

      expect(result).toEqual(['chat-1.json']);
      expect(writeTextFile).toHaveBeenCalled();
    });
  });
});
