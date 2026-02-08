import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandOutputBlock from './CommandOutputBlock';

describe('CommandOutputBlock', () => {
  it('should render command with proper prefix', () => {
    render(
      <CommandOutputBlock
        command="npm run build"
        output=""
        status="success"
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    
    expect(screen.getByText(/\$ npm run build/)).toBeInTheDocument();
  });
  
  it('should show output when expanded', () => {
    render(
      <CommandOutputBlock
        command="npm run build"
        output="Build successful!"
        status="success"
        isExpanded={true}
        onToggle={() => {}}
      />
    );
    
    expect(screen.getByText('Build successful!')).toBeInTheDocument();
  });
  
  it('should hide output when collapsed', () => {
    render(
      <CommandOutputBlock
        command="npm run build"
        output="Build successful!"
        status="success"
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    
    expect(screen.queryByText('Build successful!')).not.toBeInTheDocument();
  });
  
  it('should call onToggle when header is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    
    render(
      <CommandOutputBlock
        command="npm run build"
        output=""
        status="success"
        isExpanded={false}
        onToggle={onToggle}
      />
    );
    
    const header = screen.getByRole('button');
    await user.click(header);
    
    expect(onToggle).toHaveBeenCalledOnce();
  });
  
  it('should show success icon when status is success', () => {
    const { container } = render(
      <CommandOutputBlock
        command="npm run build"
        output=""
        status="success"
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    
    // CheckCircle icon should be present (text-green-400)
    const successIcon = container.querySelector('.text-green-400');
    expect(successIcon).toBeInTheDocument();
  });
  
  it('should show error icon when status is error', () => {
    const { container } = render(
      <CommandOutputBlock
        command="npm run build"
        output="Error: Build failed"
        status="error"
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    
    // XCircle icon should be present (text-red-400)
    const errorIcon = container.querySelector('.text-red-400');
    expect(errorIcon).toBeInTheDocument();
  });
  
  it('should show spinner when status is running', () => {
    const { container } = render(
      <CommandOutputBlock
        command="npm install"
        output="Installing packages..."
        status="running"
        isExpanded={true}
        onToggle={() => {}}
      />
    );
    
    // Loader2 icon should be present with animate-spin (text-blue-400)
    const spinner = container.querySelector('.text-blue-400.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
  
  it('should show no output message when output is empty and expanded', () => {
    render(
      <CommandOutputBlock
        command="npm run build"
        output=""
        status="success"
        isExpanded={true}
        onToggle={() => {}}
      />
    );
    
    expect(screen.getByText('(no output)')).toBeInTheDocument();
  });
});
