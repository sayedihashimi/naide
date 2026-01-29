import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/Modal';

const chipPrompts = [
  {
    label: 'Track something',
    text: 'I want an app to track ___ over time, with status and notes.',
  },
  {
    label: 'Replace a spreadsheet',
    text: 'I have a spreadsheet for ___ that is getting hard to manage. I want an easier app.',
  },
  {
    label: 'For a team',
    text: 'I want a shared app for my team to ___ with roles and permissions.',
  },
  {
    label: 'Private internal tool',
    text: 'I want an internal tool for my company to ___ and keep data private.',
  },
  {
    label: 'Public app',
    text: 'I want a public app where users can ___ and manage their own accounts.',
  },
];

const Screen1: React.FC = () => {
  const [textValue, setTextValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const { setInitialIntent } = useAppContext();

  const handleChipClick = (chipText: string) => {
    if (textValue.trim() === '') {
      setTextValue(chipText);
    } else {
      setTextValue(textValue + '\n\n' + chipText);
    }
    textareaRef.current?.focus();
  };

  const handleContinue = () => {
    const trimmedText = textValue.trim();
    if (trimmedText === '') {
      setShowModal(true);
    } else {
      setInitialIntent(trimmedText);
      navigate('/planning');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-100">Naide</h1>
          </div>

          {/* Main heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-medium text-gray-100 mb-2">
              What do you want to build?
            </h2>
            <p className="text-gray-400">
              Describe the problem you're trying to solve. We'll handle the details.
            </p>
          </div>

          {/* Textarea */}
          <div className="mb-6">
            <textarea
              ref={textareaRef}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              className="w-full h-48 bg-zinc-800 border border-zinc-700 rounded px-4 py-3 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="I want an app for my team to track customer requests...&#10;&#10;Or: I have a spreadsheet that's getting messy..."
            />
          </div>

          {/* Chips */}
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-3">Quick starts:</p>
            <div className="flex flex-wrap gap-2">
              {chipPrompts.map((chip, index) => (
                <button
                  key={index}
                  onClick={() => handleChipClick(chip.text)}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 hover:border-blue-500 hover:bg-zinc-800/80 text-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Continue button */}
          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleModalClose}
        title="Describe what you want to build"
      >
        <p>Add a short description so Naide can create a plan.</p>
      </Modal>
    </div>
  );
};

export default Screen1;
