import { useState } from 'react';
import { Contract } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/CreatePollForm.css';

type CreatePollFormProps = {
  disabled?: boolean;
  onCreated?: () => Promise<void> | void;
};

export function CreatePollForm({ disabled, onCreated }: CreatePollFormProps) {
  const signerPromise = useEthersSigner();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addOption = () => {
    if (options.length >= 4) {
      return;
    }
    setOptions((prev) => [...prev, '']);
  };

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((opt, idx) => (idx === index ? value : opt)));
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      return;
    }
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setOptions(['', '']);
    setStartDate('');
    setEndDate('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      alert('Connect your wallet to create a poll.');
      return;
    }

    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (trimmedOptions.length < 2) {
      alert('Please provide at least two options.');
      return;
    }

    if (!title.trim() || !startDate || !endDate) {
      alert('Fill in every field to continue.');
      return;
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    if (endTimestamp <= startTimestamp) {
      alert('End time must be greater than start time.');
      return;
    }

    setSubmitting(true);
    try {
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createPoll(title.trim(), description.trim(), trimmedOptions, startTimestamp, endTimestamp);
      await tx.wait();
      resetForm();
      await onCreated?.();
    } catch (error) {
      console.error('Failed to create poll', error);
      alert('Creation failed. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = disabled || submitting;

  return (
    <form className="create-poll-card" onSubmit={handleSubmit}>
      <h2>Launch a private poll</h2>

      <div className="form-row">
        <label htmlFor="poll-title">Title</label>
        <input
          id="poll-title"
          type="text"
          placeholder="Community election"
          value={title}
          disabled={isDisabled}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="form-row">
        <label htmlFor="poll-description">Description</label>
        <textarea
          id="poll-description"
          placeholder="Explain what voters are deciding"
          rows={3}
          value={description}
          disabled={isDisabled}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="form-row">
        <label>Options</label>
        <div className="options-stack">
          {options.map((option, idx) => (
            <div className="option-input" key={idx}>
              <input
                type="text"
                placeholder={`Option ${idx + 1}`}
                value={option}
                disabled={isDisabled}
                onChange={(event) => updateOption(idx, event.target.value)}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => removeOption(idx)}
                  disabled={isDisabled}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="link-button"
          onClick={addOption}
          disabled={isDisabled || options.length >= 4}
        >
          + Add option
        </button>
      </div>

      <div className="form-row">
        <label htmlFor="start-time">Voting window</label>
        <div className="option-input">
          <input
            id="start-time"
            type="datetime-local"
            value={startDate}
            disabled={isDisabled}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <input
            type="datetime-local"
            value={endDate}
            disabled={isDisabled}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <span className="muted-text">Options: {options.length}/4</span>
        <button className="primary-button" type="submit" disabled={isDisabled}>
          {submitting ? 'Creating...' : 'Create Poll'}
        </button>
      </div>
    </form>
  );
}
