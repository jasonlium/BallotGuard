import { useEffect, useMemo, useState, useCallback } from 'react';
import { Contract, JsonRpcSigner } from 'ethers';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
} from 'wagmi';

import { Header } from './Header';
import { CreatePollForm } from './CreatePollForm';
import { PollCard } from './PollCard';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/BallotApp.css';

type PollRecord = {
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

type ActionState = {
  type: 'vote' | 'finalize' | 'decrypt' | 'publish';
  pollId: number;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function BallotApp() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance, isLoading: zamaLoading } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [polls, setPolls] = useState<PollRecord[]>([]);
  const [hasVotedMap, setHasVotedMap] = useState<Record<number, boolean>>({});
  const [decryptionCache, setDecryptionCache] = useState<Record<number, DecryptionState>>({});
  const [publishedTallies, setPublishedTallies] = useState<Record<number, number[]>>({});
  const [actionState, setActionState] = useState<ActionState | null>(null);

  const { data: pollCountData, refetch: refetchPollCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'pollCount',
    query: {
      refetchInterval: 15000,
    },
  });

  const pollCount = Number(pollCountData ?? 0n);

  const pollIds = useMemo(() => {
    return Array.from({ length: pollCount }, (_, idx) => pollCount - idx - 1);
  }, [pollCount]);

  const {
    data: pollResponses,
    refetch: refetchPolls,
    isLoading: pollsLoading,
  } = useReadContracts({
    allowFailure: false,
    contracts: pollIds.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getPoll',
      args: [BigInt(id)],
    })),
    query: {
      enabled: pollIds.length > 0,
    },
  });

  useEffect(() => {
    if (!pollResponses) {
      setPolls([]);
      return;
    }

    const hydratedPolls: PollRecord[] = pollResponses.map((response, index) => {
      const id = pollIds[index] ?? 0;
      const payload = response as unknown as {
        result: [string, string, string[], bigint, bigint, boolean, boolean, string];
      };
      const [title, description, rawOptions, start, end, finalized, resultsSubmitted, creator] =
        payload.result;

      return {
        id,
        title,
        description,
        options: rawOptions,
        startTime: Number(start),
        endTime: Number(end),
        finalized,
        resultsSubmitted,
        creator,
      };
    });

    setPolls(hydratedPolls);
  }, [pollResponses, pollIds]);

  useEffect(() => {
    if (!publicClient || !address || polls.length === 0) {
      setHasVotedMap({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const statuses = await Promise.all(
          polls.map((poll) =>
            publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'hasVoted',
              args: [BigInt(poll.id), address as `0x${string}`],
            }),
          ),
        );
        if (!cancelled) {
          const tracked: Record<number, boolean> = {};
          statuses.forEach((res, idx) => {
            tracked[polls[idx]!.id] = Boolean(res);
          });
          setHasVotedMap(tracked);
        }
      } catch (error) {
        console.error('Failed to load vote state', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, polls, publicClient]);

  useEffect(() => {
    if (!publicClient) {
      return;
    }

    polls
      .filter((poll) => poll.resultsSubmitted && !publishedTallies[poll.id])
      .forEach(async (poll) => {
        try {
          const results = (await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getDecryptedResults',
            args: [BigInt(poll.id)],
          })) as readonly number[];

          setPublishedTallies((prev) => ({
            ...prev,
            [poll.id]: results.map((value) => Number(value)),
          }));

          setDecryptionCache((prev) => {
            const updated = { ...prev };
            delete updated[poll.id];
            return updated;
          });
        } catch (error) {
          console.error('Failed to load published results', error);
        }
      });
  }, [polls, publicClient, publishedTallies]);

  const refreshData = useCallback(async () => {
    await Promise.all([refetchPollCount(), refetchPolls()]);
  }, [refetchPollCount, refetchPolls]);

  const getContract = useCallback(
    (signer: JsonRpcSigner) => new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer),
    [],
  );

  const handleVote = useCallback(
    async (pollId: number, optionIndex: number) => {
      if (!instance || !address) {
        alert('Connect wallet and wait for the encryptor.');
        return;
      }
      const signer = await signerPromise;
      if (!signer) {
        alert('Connect your wallet to vote.');
        return;
      }

      setActionState({ pollId, type: 'vote' });
      try {
        const encryptedInput = await instance
          .createEncryptedInput(CONTRACT_ADDRESS, address)
          .add32(optionIndex)
          .encrypt();

        const contract = getContract(signer);
        const tx = await contract.submitVote(
          pollId,
          encryptedInput.handles[0],
          encryptedInput.inputProof,
        );
        await tx.wait();
        await refreshData();
      } catch (error) {
        console.error('Failed to submit vote', error);
        alert('Vote failed. Please try again.');
      } finally {
        setActionState(null);
      }
    },
    [address, getContract, instance, refreshData, signerPromise],
  );

  const handleFinalize = useCallback(
    async (pollId: number) => {
      const signer = await signerPromise;
      if (!signer) {
        alert('Connect your wallet to finalize a poll.');
        return;
      }

      setActionState({ pollId, type: 'finalize' });
      try {
        const contract = getContract(signer);
        const tx = await contract.finalizePoll(pollId);
        await tx.wait();
        await refreshData();
      } catch (error) {
        console.error('Failed to finalize poll', error);
        alert('Finalization failed. Please try again.');
      } finally {
        setActionState(null);
      }
    },
    [getContract, refreshData, signerPromise],
  );

  const handleDecrypt = useCallback(
    async (pollId: number) => {
      if (!instance || !publicClient) {
        alert('Encryption service unavailable.');
        return;
      }

      setActionState({ pollId, type: 'decrypt' });
      try {
        const handles = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getEncryptedResults',
          args: [BigInt(pollId)],
        })) as `0x${string}`[];

        if (handles.length === 0) {
          alert('No tallies available for this poll yet.');
          setActionState(null);
          return;
        }

        const publicDecryptResult = await instance.publicDecrypt(handles);
        const tallies = handles.map((handle) => {
          const value = publicDecryptResult.clearValues[handle];
          return Number(value ?? 0n);
        });

        setDecryptionCache((prev) => ({
          ...prev,
          [pollId]: {
            tallies,
            encodedResults: publicDecryptResult.abiEncodedClearValues,
            proof: publicDecryptResult.decryptionProof,
          },
        }));
      } catch (error) {
        console.error('Failed to decrypt results', error);
        alert('Decryption failed. Ensure the poll is finalized.');
      } finally {
        setActionState(null);
      }
    },
    [instance, publicClient],
  );

  const handlePublishResults = useCallback(
    async (pollId: number) => {
      const signer = await signerPromise;
      if (!signer) {
        alert('Connect your wallet to submit results.');
        return;
      }

      const cached = decryptionCache[pollId];
      if (!cached) {
        alert('Decrypt the poll before publishing.');
        return;
      }

      setActionState({ pollId, type: 'publish' });
      try {
        const contract = getContract(signer);
        const tx = await contract.submitDecryptedResults(
          pollId,
          cached.encodedResults,
          cached.proof,
        );
        await tx.wait();
        await refreshData();
      } catch (error) {
        console.error('Failed to publish results', error);
        alert('Publishing failed. Please retry.');
      } finally {
        setActionState(null);
      }
    },
    [decryptionCache, getContract, refreshData, signerPromise],
  );

  const actionMatches = useCallback(
    (pollId: number, type: ActionState['type']) =>
      actionState?.pollId === pollId && actionState.type === type,
    [actionState],
  );

  return (
    <>
      <Header />
      <main className="ballot-app">
        <div className="ballot-layout">
          <section>
            <h2 className="section-title">Create Poll</h2>
            <CreatePollForm
              disabled={zamaLoading}
              onCreated={refreshData}
            />
          </section>
          <section>
            <h2 className="section-title">
              Active Polls ({pollCount})
            </h2>
            {pollsLoading && pollCount > 0 && (
              <div className="empty-state">Loading polls...</div>
            )}
            {!pollsLoading && polls.length === 0 && (
              <div className="empty-state">
                <p className="empty-title">No polls have been created yet.</p>
                <p>Create one from the form on the left to get started.</p>
              </div>
            )}
            <div className="poll-grid">
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  hasVoted={hasVotedMap[poll.id] ?? false}
                  decryptState={decryptionCache[poll.id]}
                  publishedResults={publishedTallies[poll.id]}
                  onVote={handleVote}
                  onFinalize={handleFinalize}
                  onDecrypt={handleDecrypt}
                  onPublish={handlePublishResults}
                  busyState={actionMatches}
                  userAddress={address ?? ZERO_ADDRESS}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
