import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GenerateAppScreen: React.FC = () => {
  const navigate = useNavigate();
  const [messageInput, setMessageInput] = useState('');

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-100">Naide</h1>
      </div>

      {/* Main content area - 3 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Navigation Sidebar */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Navigation
            </h2>
            <nav>
              <button
                onClick={() => navigate('/planning')}
                className="w-full text-left px-3 py-2 rounded mb-1 transition-colors text-gray-400 hover:bg-zinc-800/50 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Planning
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded mb-1 transition-colors bg-zinc-800 text-gray-100 font-medium"
                disabled
              >
                Generate
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded mb-1 transition-colors text-gray-500 cursor-not-allowed"
                disabled
              >
                Activity
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded mb-1 transition-colors text-gray-500 cursor-not-allowed"
                disabled
              >
                Files
              </button>
            </nav>
          </div>
        </div>

        {/* Center: Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-2xl font-semibold text-gray-100 mb-1">Generate App</h2>
            <p className="text-sm text-gray-400">
              Talk to Naide to generate and refine your app.
            </p>
          </div>

          {/* Transcript area */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Placeholder assistant messages */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <p className="text-gray-100">
                      I'm ready. I'll generate an app based on your plan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <p className="text-gray-100">
                      Before I start, is there anything you want to emphasize or clarify?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input row */}
          <div className="border-t border-zinc-800 p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                  disabled
                />
                <div className="flex flex-col gap-2">
                  <button
                    disabled
                    className="px-4 py-2 bg-zinc-800 text-gray-500 rounded-lg cursor-not-allowed"
                  >
                    Send
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 bg-zinc-800 text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center"
                    title="Attach file"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Running App Preview */}
        <div className="w-96 bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Running App</h3>

            {/* Empty state */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-300 mb-2">Your app will appear here once generated.</p>
              <p className="text-sm text-gray-500">Not running yet</p>
            </div>

            {/* Optional control buttons (disabled) */}
            <div className="mt-6 space-y-2">
              <button
                disabled
                className="w-full px-4 py-2 bg-zinc-800 text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Start
              </button>
              <button
                disabled
                className="w-full px-4 py-2 bg-zinc-800 text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                Stop
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateAppScreen;
