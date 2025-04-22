'use client';
import { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Topbar } from '../components/topbar';
import { useParams } from 'next/navigation';
import { getUserToken } from '../actions/getToken';


interface TestCaseResult {
  testCase: number;
  input: string;
  expected: string;
  actual?: string;
  passed: boolean;
  error?: { type: string; detail: string };
}

interface FinalStatus {
  status: string; 
}

interface ErrorMessage {
  error: string; 
  detail: string; 
}

type ServerMessage = TestCaseResult | FinalStatus | ErrorMessage;

export default function ProblemPage() {
  const { id } = useParams();
  const [token, setToken] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('cpp');
  const [userCode, setUserCode] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    problem: { title: string; difficulty: string; tags: string; description: string };
    boilerplate: { [key: string]: string };
  } | null>(null);
  const [boilerplate, setBoilerplate] = useState<{ [key: string]: string } | null>(null);
  const [results, setResults] = useState<ServerMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('Idle');

  
  const ws = useRef<WebSocket | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const latestResultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const userToken = await getUserToken();
        if (userToken) {
          setToken(userToken);
          console.log('Token fetched:', userToken);
        } else {
          console.warn('No token received from getUserToken');
          setSubmissionStatus('Please log in to submit code.');
        }
      } catch (error) {
        console.error('Error fetching token:', error);
        setSubmissionStatus('Please log in to submit code.');
      }
    };
    fetchToken();
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!token || !id) {
      console.log('Waiting for token or problem ID...');
      return;
    }

    const wsUrl = `ws://localhost:8080?token=${encodeURIComponent(token)}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);

    // Clean up existing connection
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      ws.current.close();
    }

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setSubmissionStatus('Ready to submit');
    };

    ws.current.onmessage = (event) => {
      console.log('Raw WebSocket message:', event.data);
      try {
        const message: ServerMessage = JSON.parse(event.data);
        console.log('Parsed message:', message);

        // Update results
        setResults((prev) => {
          const newResults = [...prev, message];
          console.log('Updated results:', newResults);
          return newResults;
        });

        // Update submission status based on message
        if ('status' in message) {
          // FinalStatus
          setSubmissionStatus(message.status);
          setIsSubmitting(false);
        } else if ('error' in message) {
          // ErrorMessage
          if ('detail' in message) {
            setSubmissionStatus(`Error: ${message.error} - ${message.detail}`);
          } else {
            setSubmissionStatus(`Error: ${message.error}`);
          }
          setIsSubmitting(false);
        } else if ('testCase' in message) {
          // TestCaseResult
          const status = message.passed
            ? `Test Case ${message.testCase}: Passed`
            : `Test Case ${message.testCase}: Failed${message.error ? ` (${message.error.type})` : ''}`;
          setSubmissionStatus(status);
          if (!message.passed) {
            setIsSubmitting(false);
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error, 'Raw data:', event.data);
        setResults((prev) => [
          ...prev,
          { error: 'Client Error', detail: `Failed to parse server message: ${String(error)}` },
        ]);
        setSubmissionStatus('Error parsing server response');
        setIsSubmitting(false);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setSubmissionStatus('WebSocket connection error');
      setIsSubmitting(false);
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      let status = `WebSocket closed: ${event.reason || 'Unknown reason'} (Code: ${event.code})`;
      if (event.code === 1008) {
        status = 'Authentication failed. Please log in again.';
      }
      setSubmissionStatus(status);
      setIsSubmitting(false);
    };

    return () => {
      console.log('Cleaning up WebSocket');
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [token, id]);

  // Fetch problem data
  useEffect(() => {
    const fetchProblem = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/problems/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch problem: ${response.statusText}`);
        }
        const data = await response.json();
        setData(data);

        interface BoilerplateItem {
          name: string;
          boilerplate: string;
        }

        const bpData = (data.boilerplate || []).reduce((acc: { [key: string]: string }, item: BoilerplateItem) => {
          if (item && typeof item.name === 'string' && item.boilerplate !== undefined && item.boilerplate !== null) {
            acc[item.name.toLowerCase()] = item.boilerplate;
          } else {
            console.warn('Skipping malformed boilerplate item:', item);
          }
          return acc;
        }, {});
        setBoilerplate(bpData);
        setUserCode(bpData[selectedLanguage] || '');
      } catch (error) {
        console.error('Error fetching problem:', error);
        setSubmissionStatus('Error loading problem data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProblem();
  }, [id, selectedLanguage]);

  // Update user code when language changes
  useEffect(() => {
    if (boilerplate) {
      setUserCode(boilerplate[selectedLanguage] || '');
    }
  }, [selectedLanguage, boilerplate]);

  // Auto-scroll to the latest result
  useEffect(() => {
    if (latestResultRef.current) {
      latestResultRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [results]);

  // Handle submission
  const handleSubmit = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      setSubmissionStatus('WebSocket not connected. Please refresh.');
      return;
    }

    if (!userCode) {
      console.warn('No code to submit');
      setSubmissionStatus('No code to submit');
      return;
    }

    if (isSubmitting) {
      console.log('Already submitting');
      return;
    }

    setIsSubmitting(true);
    setResults([]);
    setSubmissionStatus('Submitting...');

    const submissionMessage = {
      lang: selectedLanguage,
      code: userCode,
      problemId: id,
    };

    try {
      ws.current.send(JSON.stringify(submissionMessage));
      console.log('Submission sent:', submissionMessage);
    } catch (error) {
      console.error('Failed to send submission:', error);
      setSubmissionStatus('Failed to send code');
      setResults((prev) => [
        ...prev,
        { error: 'Client Error', detail: 'Failed to send code to server' },
      ]);
      setIsSubmitting(false);
    }
  };

  if (isLoading || !data || !boilerplate) {
    return <div className="flex justify-center items-center h-screen text-xl">Loading...</div>;
  }

  return (
    <div className="bg-purple-200 min-h-screen">
      <Topbar />
      <div className="grid grid-cols-5 justify-items-center w-full gap-3 p-4">
        <div className="col-span-5 md:col-span-2 w-full px-4 pt-4">
          <h1 className="text-2xl font-mono text-gray-800 font-semibold mb-6">{data.problem.title}</h1>
          <p className="text-sm font-thin text-gray-800 pb-2">
            Difficulty: <span className="font-semibold">{data.problem.difficulty}</span>
          </p>
          <p className="text-sm font-thin text-gray-800 pb-2">
            Tags: <span className="font-semibold">{data.problem.tags}</span>
          </p>
          <p className="text-sm font-sans text-black pb-3">Description:</p>
          <p style={{ whiteSpace: 'pre-line' }} className="text-md font-mono text-gray-800">
            {data.problem.description}
          </p>
        </div>
        <div className="col-span-5 md:col-span-3 w-full h-full flex flex-col px-4 md:px-0">
          <div className="mb-2 flex justify-between items-center">
            <select
              className="p-2 text-gray-800 bg-purple-200 border border-2 border-gray-800 rounded-lg hover:bg-gray-800 hover:text-gray-200"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="javascript">JavaScript</option>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
            </select>
            <span className="text-sm font-mono text-gray-700 ml-4">Status: {submissionStatus}</span>
          </div>
          <Editor
            height="70vh"
            width="100%"
            language={selectedLanguage}
            value={userCode}
            theme="vs-dark"
            onChange={(value) => setUserCode(value || '')}
            options={{ readOnly: isSubmitting }}
          />
          <div className="flex justify-end w-[100%] mt-2">
            <button
              className={`bg-purple-200 text-gray-800 border border-2 border-gray-800 px-2 py-1 rounded-lg ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 hover:text-gray-200'
              }`}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Running Tests...' : 'Submit'}
            </button>
          </div>
          <div
            ref={resultsRef}
            className="mt-4 w-[100%] md:w-[90%] pr-0 md:pr-[3vw] bg-gray-800 text-gray-200 p-4 rounded-lg font-mono text-sm overflow-auto max-h-[30vh]"
          >
            <h3 className="text-lg font-semibold mb-2">Results:</h3>
            {results.length === 0 ? (
              <p>Submit your code to see results.</p>
            ) : (
              results.map((result, index) => (
                <div
                  key={index}
                  ref={index === results.length - 1 ? latestResultRef : null}
                  className="border-b border-gray-700 pb-3 mb-3 last:border-b-0 last:mb-0"
                >
                  {'testCase' in result ? (
                    <>
                      <p>
                        <strong>Test Case {result.testCase}:</strong>{' '}
                        {result.passed ? (
                          <span className="text-green-400">Passed</span>
                        ) : (
                          <span className="text-red-400">Failed</span>
                        )}
                      </p>
                      {result.error && (
                        <p className="text-red-500">
                          Error: {result.error.type} - {result.error.detail}
                        </p>
                      )}
                      {!result.passed && !result.error && (
                        <>
                          <p className="text-yellow-400">Mismatch (Expected vs Actual):</p>
                          <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                            <div>
                              <strong>Expected:</strong>
                              <pre className="bg-gray-700 p-2 rounded overflow-x-auto">{result.expected}</pre>
                            </div>
                            <div>
                              <strong>Actual:</strong>
                              <pre className="bg-gray-700 p-2 rounded overflow-x-auto">{result.actual || 'N/A'}</pre>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : 'status' in result ? (
                    <p>
                      <strong>Final Status:</strong>{' '}
                      <span
                        className={result.status.includes('passed') ? 'text-green-400' : 'text-red-400'}
                      >
                        {result.status}
                      </span>
                    </p>
                  ) : (
                    <p className="text-red-500">
                      <strong>Error:</strong> {result.error} - {result.detail}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}