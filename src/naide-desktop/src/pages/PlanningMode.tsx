import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { open } from '@tauri-apps/plugin-dialog';

const sections = [
  'Overview',
  'Features',
  'Data',
  'Access & Rules',
  'Assumptions',
  'Plan Status',
];

const codeSection = 'Code';

interface Question {
  id: string;
  question: string;
  type: 'text' | 'textarea';
  helper?: string;
}

const sectionQuestions: Record<string, Question[]> = {
  Overview: [
    {
      id: 'what-to-build',
      question: 'What do you want to build?',
      type: 'textarea',
      helper: 'Describe your app idea in a few sentences',
    },
    {
      id: 'target-users',
      question: 'Who will use this app?',
      type: 'text',
      helper: 'e.g., "My team", "Internal employees", "Public users"',
    },
    {
      id: 'main-problem',
      question: 'What problem does this solve?',
      type: 'textarea',
    },
  ],
  Features: [
    {
      id: 'core-features',
      question: 'What are the main features you need?',
      type: 'textarea',
      helper: 'List the essential capabilities',
    },
    {
      id: 'nice-to-have',
      question: 'What features would be nice to have later?',
      type: 'textarea',
    },
    {
      id: 'workflows',
      question: 'Describe a typical user workflow',
      type: 'textarea',
    },
  ],
  Data: [
    {
      id: 'what-data',
      question: 'What information needs to be stored?',
      type: 'textarea',
      helper: 'e.g., user profiles, records, documents',
    },
    {
      id: 'data-relationships',
      question: 'How is the data related?',
      type: 'textarea',
    },
    {
      id: 'data-volume',
      question: 'Roughly how much data will there be?',
      type: 'text',
      helper: 'e.g., "hundreds of items", "thousands of users"',
    },
  ],
  'Access & Rules': [
    {
      id: 'who-access',
      question: 'Who should have access to what?',
      type: 'textarea',
      helper: 'Describe roles and permissions',
    },
    {
      id: 'business-rules',
      question: 'Are there any important business rules?',
      type: 'textarea',
      helper: 'e.g., approval workflows, validation rules',
    },
    {
      id: 'security',
      question: 'Any specific security requirements?',
      type: 'textarea',
    },
  ],
  Assumptions: [
    {
      id: 'tech-constraints',
      question: 'Any technology constraints?',
      type: 'textarea',
      helper: 'e.g., must run on Windows, cloud-only',
    },
    {
      id: 'timeline',
      question: 'When do you need this?',
      type: 'text',
    },
    {
      id: 'other-notes',
      question: 'Anything else we should know?',
      type: 'textarea',
    },
  ],
  'Plan Status': [
    {
      id: 'plan-ready',
      question: 'Is the plan ready to generate?',
      type: 'text',
      helper: 'This section is informational',
    },
  ],
};

// File mappings for Code section
const sectionFileMapping: Record<string, string> = {
  'Overview': 'Intent.md',
  'Features': 'AppSpec.md',
  'Data': 'DataSpec.md',
  'Access & Rules': 'Rules.md',
  'Assumptions': 'Assumptions.md',
  'Plan Status': 'Tasks.json',
};

const PlanningMode: React.FC = () => {
  const { state, updateSectionAnswer, getSectionAnswer, setPlanDirty, saveProject } = useAppContext();
  const [selectedSection, setSelectedSection] = useState('Overview');
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [expandedTextareas, setExpandedTextareas] = useState<Set<string>>(new Set());
  const [showAllMissing, setShowAllMissing] = useState(false);

  // Pre-fill the initial intent text into Overview
  useEffect(() => {
    if (state.initialIntentText && !getSectionAnswer('Overview', 'what-to-build')) {
      updateSectionAnswer('Overview', 'what-to-build', state.initialIntentText);
      // Reset dirty state after initial prefill
      setPlanDirty(false);
    }
  }, [state.initialIntentText, getSectionAnswer, updateSectionAnswer, setPlanDirty]);

  // Auto-save when content changes (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (Object.keys(state.sections).length > 0) {
        try {
          await saveProject();
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [state.sections, saveProject]);

  const handleRebuildPlan = async () => {
    try {
      await saveProject();
      setPlanDirty(false);
      setShowRebuildConfirm(true);
      setTimeout(() => setShowRebuildConfirm(false), 2000);
    } catch (error) {
      console.error('Failed to update plan:', error);
      alert('Failed to update plan. Please try again.');
    }
  };

  const handleGenerateApp = () => {
    alert('Coming soon: Generate App functionality');
  };

  const handleProjectNameClick = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open Naide Project',
      });

      if (selected) {
        const projectName = selected.split(/[/\\]/).pop() || 'MyApp';
        alert(`Project opening: ${projectName}\n(Full loading not yet implemented)`);
      }
    } catch (error) {
      console.error('Error opening project:', error);
      // Fallback for browser/dev mode
      alert(`Current project: ${state.projectName}\n\n(Project switching requires Tauri runtime)`);
    }
  };

  const currentQuestions = sectionQuestions[selectedSection] || [];

  const toggleTextareaSize = (questionId: string) => {
    setExpandedTextareas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // Calculate missing info with section and question ID mapping
  interface MissingInfoItem {
    section: string;
    questionId: string;
    text: string;
  }
  
  const missingInfoItems: MissingInfoItem[] = [];
  sections.forEach((section) => {
    const questions = sectionQuestions[section];
    questions?.forEach((q) => {
      const answer = getSectionAnswer(section, q.id);
      if (!answer || answer.trim() === '') {
        missingInfoItems.push({
          section,
          questionId: q.id,
          text: `${section}: ${q.question}`,
        });
      }
    });
  });

  const handleMissingInfoClick = (item: MissingInfoItem) => {
    setSelectedSection(item.section);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Naide</h1>
        <button
          onClick={handleProjectNameClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Click to open a different project"
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <span className="text-sm font-medium">{state.projectName}</span>
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-56 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Sections
            </h2>
            <nav>
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => setSelectedSection(section)}
                  className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    selectedSection === section
                      ? 'bg-zinc-800 text-gray-100 font-medium'
                      : 'text-gray-400 hover:bg-zinc-800/50 hover:text-gray-100'
                  }`}
                >
                  {section}
                </button>
              ))}
              
              {/* Separator before Code section */}
              <div className="my-4 border-t border-zinc-700"></div>
              
              <button
                key={codeSection}
                onClick={() => setSelectedSection(codeSection)}
                className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  selectedSection === codeSection
                    ? 'bg-zinc-800 text-gray-100 font-medium'
                    : 'text-gray-400 hover:bg-zinc-800/50 hover:text-gray-100'
                }`}
              >
                {codeSection}
              </button>
            </nav>
          </div>
        </div>

        {/* Center: Guided Q&A */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-gray-100 mb-6">
              {selectedSection}
            </h2>

            {selectedSection === codeSection ? (
              /* Code section - Show file list */
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-gray-100 mb-4">
                  Files to be generated
                </h3>
                <div className="space-y-3">
                  {Object.entries(sectionFileMapping).map(([section, filename]) => (
                    <div 
                      key={section}
                      className="flex items-center justify-between py-2 px-3 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg 
                          className="w-5 h-5 text-blue-400" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                          />
                        </svg>
                        <div>
                          <div className="text-gray-100 font-mono text-sm">{filename}</div>
                          <div className="text-gray-500 text-xs">{section}</div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 px-2 py-1 bg-zinc-900 rounded">
                        {filename.endsWith('.json') ? 'JSON' : 'Markdown'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Regular sections - Show Q&A */
              <div className="space-y-6">
                {currentQuestions.map((question) => (
                  <div key={question.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                    <label className="block mb-2">
                      <span className="text-gray-100 font-medium">{question.question}</span>
                      {question.helper && (
                        <span className="block text-sm text-gray-500 mt-1">{question.helper}</span>
                      )}
                    </label>
                    {question.type === 'textarea' ? (
                      <div className="relative">
                        <textarea
                          value={getSectionAnswer(selectedSection, question.id)}
                          onChange={(e) =>
                            updateSectionAnswer(selectedSection, question.id, e.target.value)
                          }
                          className={`w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                            expandedTextareas.has(question.id) ? 'h-64' : 'h-24'
                          }`}
                          placeholder="Your answer..."
                        />
                        {/* AI Assist button */}
                        <button
                          onClick={() => {/* AI assist placeholder */}}
                          className="absolute bottom-2 right-14 p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-zinc-700 rounded transition-colors"
                          title="AI Assist"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                          </svg>
                        </button>
                        {/* Expand/Collapse button */}
                        <button
                          onClick={() => toggleTextareaSize(question.id)}
                          className="absolute bottom-2 right-2 p-1.5 text-gray-400 hover:text-gray-200 hover:bg-zinc-700 rounded transition-colors"
                          title={expandedTextareas.has(question.id) ? 'Collapse' : 'Expand'}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            {expandedTextareas.has(question.id) ? (
                              // Collapse icon
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 14l-7 7m0 0l-7-7m7 7V3"
                              />
                            ) : (
                              // Expand icon
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                              />
                            )}
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <input
                      type="text"
                      value={getSectionAnswer(selectedSection, question.id)}
                      onChange={(e) =>
                        updateSectionAnswer(selectedSection, question.id, e.target.value)
                      }
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your answer..."
                    />
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Right: Review Panel */}
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Plan Review</h3>

          {/* Missing Info */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Missing Information</h4>
            {missingInfoItems.length > 0 ? (
              <ul className="text-sm text-gray-500 space-y-1">
                {(showAllMissing ? missingInfoItems : missingInfoItems.slice(0, 5)).map((item, i) => (
                  <li key={i} className="truncate">
                    <button
                      onClick={() => handleMissingInfoClick(item)}
                      className="text-left hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      • {item.text}
                    </button>
                  </li>
                ))}
                {missingInfoItems.length > 5 && (
                  <li>
                    <button
                      onClick={() => setShowAllMissing(!showAllMissing)}
                      className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      {showAllMissing ? 'less' : `+ ${missingInfoItems.length - 5} more`}
                    </button>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">All questions answered</p>
            )}
          </div>

          {/* Assumptions */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Assumptions</h4>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• App will be web-based</li>
              <li>• Standard modern browsers supported</li>
            </ul>
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Notes</h4>
            <p className="text-sm text-gray-500">
              Review your answers and click "Update plan" when ready to update.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {state.planDirty && (
            <span className="text-sm text-yellow-500 font-medium">Plan is out of date</span>
          )}
          <button
            onClick={handleRebuildPlan}
            disabled={!state.planDirty}
            className={`px-4 py-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
              state.planDirty
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500'
                : 'bg-zinc-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            Update plan
          </button>
          {showRebuildConfirm && (
            <span className="text-sm text-green-500">✓ Plan updated</span>
          )}
        </div>

        <button
          onClick={handleGenerateApp}
          disabled={state.planDirty}
          className={`px-6 py-2.5 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
            state.planDirty
              ? 'bg-zinc-800 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
          }`}
        >
          Generate App
        </button>
      </div>
    </div>
  );
};

export default PlanningMode;
