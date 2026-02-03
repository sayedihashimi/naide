import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ActivityStatusBar from './ActivityStatusBar';

describe('ActivityStatusBar', () => {
  it('should not render when there are no events', () => {
    const { container } = render(<ActivityStatusBar />);
    // Component returns null when there are no events
    expect(container.firstChild).toBeNull();
  });

  it('should render without errors', () => {
    const { container } = render(<ActivityStatusBar />);
    // Should not throw any errors during render
    expect(container).toBeDefined();
  });
});
