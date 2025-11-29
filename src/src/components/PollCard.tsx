import { useMemo, useState } from 'react';
import '../styles/PollCard.css';

type PollSummary = {
  id: number;
  title: string;
  description: string;
  options: string[];
  startTime: number;
  endTime: number;
  finalized: boolean;
  resultsSubmitted: boolean;
  creator: string;
};

type DecryptionState = {
  tallies: number[];
  encodedResults: string;
  proof: string;
};

type BusyMatcher = (pollId: number, type: 'vote' | 'finalize' | 'decrypt' | 'publish') => boolean;

type PollCardProps = {
  poll: PollSummary;
  hasVoted: boolean;
  decryptState?: DecryptionState;
  publishedResults?: number[];
  userAddress: string;
  busyState: BusyMatcher;
  onVote: (pollId: number, optionIndex: number) => Promise<void> | void;
  onFinalize: (pollId: number) => Promise<void> | void;
  onDecrypt: (pollId: number) => Promise<void> | void;
  onPublish: (pollId: number) => Promise<void> | void;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatTimestamp(value: number) {
  if (!value) {
    return 'N/A';
  }
  return new Date(value * 1000).toLocaleString();
}

function truncateAddress(address: string) {
  if (!address || address === ZERO_ADDRESS) {
    return 'Unknown';
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function PollCard({
  poll,
  hasVoted,
  decryptState,
  publishedResults,
  userAddress,
  busyState,
  onVote,
  onFinalize,
  onDecrypt,
  onPublish,
}: PollCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const now = Math.floor(Date.now() / 1000);

  const status = useMemo(() => {
    if (now < poll.startTime) {
      return 'upcoming';
    }
    if (now > poll.endTime) {
      return 'finished';
    }
    return 'active';
  }, [now, poll.startTime, poll.endTime]);

  const canVote =
    status === 'active' &&
    !hasVoted &&
    userAddress !== ZERO_ADDRESS &&
    poll.options.length > 0 &&
    !busyState(poll.id, 'vote');

  const showFinalize = status === 'finished' && !poll.finalized && !busyState(poll.id, 'finalize');
  const showDecrypt =
    poll.finalized && !poll.resultsSubmitted && !busyState(poll.id, 'decrypt') && !decryptState;
  const showPublish =
    !!decryptState && !poll.resultsSubmitted && !busyState(poll.id, 'publish');

  const resultsToDisplay = publishedResults ?? decryptState?.tallies;

  const handleVote = () => {
    if (selectedOption === null) {
      alert('Select an option before voting.');
      return;
    }
    onVote(poll.id, selectedOption);
  };

  return (
    <article className="poll-card">
      <div className="poll-card-header">
        <div>
          <h3>{poll.title}</h3>
          <p className="helper-text">{poll.description || 'No description provided.'}</p>
        </div>
        <span className={`status-pill status-${status}`}>
          {status}
        </span>
      </div>

      <div className="poll-meta">
        <span>Start: {formatTimestamp(poll.startTime)}</span>
        <span>End: {formatTimestamp(poll.endTime)}</span>
        <span>Creator: {truncateAddress(poll.creator)}</span>
      </div>

      <div className="chip-stack">
        {poll.finalized && <span className="chip">Finalized</span>}
        {poll.resultsSubmitted && <span className="chip">Results on-chain</span>}
        {hasVoted && <span className="chip">You voted</span>}
      </div>

      <div className="options-list">
        {poll.options.map((option, idx) => (
          <label className="option-radio" key={idx}>
            <input
              type="radio"
              name={`poll-${poll.id}`}
              value={idx}
              disabled={!canVote}
              checked={selectedOption === idx}
              onChange={() => setSelectedOption(idx)}
            />
            {option}
          </label>
        ))}
      </div>

      <div className="card-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={!canVote}
          onClick={handleVote}
        >
          {busyState(poll.id, 'vote') ? 'Submitting...' : 'Vote'}
        </button>

        {showFinalize && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => onFinalize(poll.id)}
          >
            Finalize Poll
          </button>
        )}

        {showDecrypt && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => onDecrypt(poll.id)}
          >
            Decrypt Tallies
          </button>
        )}

        {showPublish && (
          <button
            className="danger-button"
            type="button"
            onClick={() => onPublish(poll.id)}
          >
            Publish Results
          </button>
        )}
      </div>

      {resultsToDisplay && (
        <div>
          <p className="helper-text">
            {publishedResults ? 'Verified results on-chain' : 'Locally decrypted preview'}
          </p>
          <div className="results-grid">
            {poll.options.map((option, idx) => (
              <div className="result-row" key={idx}>
                <span>{option}</span>
                <span>{resultsToDisplay[idx] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
