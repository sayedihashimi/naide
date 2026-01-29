import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const sections = [
  'Overview',
  'Features',
  'Data',
  'Access & Rules',
  'Assumptions',
  'Plan Status',
];

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

const PlanningMode: React.FC = () => {
  const { state, updateSectionAnswer, getSectionAnswer, setPlanDirty } = useAppContext();
  const [selectedSection, setSelectedSection] = useState('Overview');
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);

  // Pre-fill the initial intent text into Overview
  useEffect(() => {
    if (state.initialIntentText && !getSectionAnswer('Overview', 'what-to-build')) {
      updateSectionAnswer('Overview', 'what-to-build', state.initialIntentText);
      // Reset dirty state after initial prefill
      setPlanDirty(false);
    }
  }, [state.initialIntentText]);

  const handleRebuildPlan = () => {
    setPlanDirty(false);
    setShowRebuildConfirm(true);
    setTimeout(() => setShowRebuildConfirm(false), 2000);
  };

  const handleGenerateApp = () => {
    alert('Coming soon: Generate App functionality');
  };

  const currentQuestions = sectionQuestions[selectedSection] || [];

  // Calculate missing info
  const missingInfo: string[] = [];
  sections.forEach((section) => {
    const questions = sectionQuestions[section];
    questions.forEach((q) => {
      const answer = getSectionAnswer(section, q.id);
      if (!answer || answer.trim() === '') {
        missingInfo.push(`${section}: ${q.question}`);
      }
    });
  });

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-100">Naide</h1>
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
            </nav>
          </div>
        </div>

        {/* Center: Guided Q&A */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-gray-100 mb-6">
              {selectedSection}
            </h2>

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
                    <textarea
                      value={getSectionAnswer(selectedSection, question.id)}
                      onChange={(e) =>
                        updateSectionAnswer(selectedSection, question.id, e.target.value)
                      }
                      className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your answer..."
                    />
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
          </div>
        </div>

        {/* Right: Review Panel */}
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Plan Review</h3>

          {/* Missing Info */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Missing Information</h4>
            {missingInfo.length > 0 ? (
              <ul className="text-sm text-gray-500 space-y-1">
                {missingInfo.slice(0, 5).map((info, i) => (
                  <li key={i} className="truncate">• {info}</li>
                ))}
                {missingInfo.length > 5 && (
                  <li className="text-gray-500">+ {missingInfo.length - 5} more</li>
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
              Review your answers and click "Rebuild Plan" when ready to update.
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
            Rebuild Plan
          </button>
          {showRebuildConfirm && (
            <span className="text-sm text-green-500">✓ Plan rebuilt</span>
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
