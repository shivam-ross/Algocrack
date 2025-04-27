'use client';
import { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Topbar } from '../components/topbar';
import { useParams, useRouter } from 'next/navigation';
import { getUserToken } from '../actions/getToken';
import { $Enums } from '@prisma/client';


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
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'javascript' | 'cpp' | 'python'>('javascript');
  const [userCode, setUserCode] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    title: string;
    description: string;
    tags: string;
    difficulty: $Enums.Difficulty;
    boilerplate: {
        javascript: string;
        cpp: string;
        python: string;
    };
}>();
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

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let monitorInterval: NodeJS.Timeout | null = null;
    let isMounted = true;
  
    const connectWebSocket = () => {
      if (!token || !id) {
        console.log('Waiting for token or problem ID...');
        setSubmissionStatus('Waiting for authentication...');
        return;
      }
  
      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
        console.log('WebSocket already connected or connecting');
        return;
      }
  
      const wsUrl = `wss://judge.shivamross.com?token=${encodeURIComponent(token)}`;
      console.log(`Connecting to WebSocket: ${wsUrl}`);
  
      if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
        ws.current.close();
      }
  
      ws.current = new WebSocket(wsUrl);
  
      ws.current.onopen = () => {
        if (!isMounted) return;
        console.log('WebSocket connected');
        setSubmissionStatus('Ready to submit');

        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      };
  
      ws.current.onmessage = (event) => {
        if (!isMounted) return;
        console.log('Raw WebSocket message:', event.data);
        try {
          const message: ServerMessage = JSON.parse(event.data);
          console.log('Parsed message:', message);
  
          setResults((prev) => {
            const newResults = [...prev, message];
            console.log('Updated results:', newResults);
            return newResults;
          });
  
          if ('status' in message) {
            setSubmissionStatus(message.status);
            setIsSubmitting(false);
          } else if ('error' in message) {
            if ('detail' in message) {
              setSubmissionStatus(`Error: ${message.error} - ${message.detail}`);
            } else {
              setSubmissionStatus(`Error: ${message.error}`);
            }
            setIsSubmitting(false);
          } else if ('testCase' in message) {
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
        if (!isMounted) return;
        console.error('WebSocket error:', error);
        setSubmissionStatus('WebSocket connection error');
        setIsSubmitting(false);
      };
  
      ws.current.onclose = (event) => {
        if (!isMounted) return;
        console.log('WebSocket closed:', event.code, event.reason);
        let status = 'Disconnected, attempting to reconnect...';
        if (event.code === 1008) {
          status = 'Authentication failed. Please log in again.';
          setSubmissionStatus(status);
          return; // Don't reconnect on auth failure
        }
        setSubmissionStatus(status);
        setIsSubmitting(false);
  
        if (isMounted) {
          console.log('Scheduling reconnection attempt...');
          const delay = Math.min(1000 * 2 ** (Math.random() * 3), 30000); // Exponential backoff up to 30s
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              connectWebSocket();
            }
          }, delay);
        }
      };
    };
  
    connectWebSocket();
  
    monitorInterval = setInterval(() => {
      if (!isMounted) return;
      if (ws.current) {
        if (ws.current.readyState === WebSocket.CLOSED) {
          console.log('WebSocket is closed, attempting to reconnect...');
          setSubmissionStatus('Disconnected, attempting to reconnect...');
          connectWebSocket();
        } else if (ws.current.readyState === WebSocket.CONNECTING) {
          setSubmissionStatus('Connecting to server...');
        } else if (ws.current.readyState === WebSocket.OPEN && navigator.onLine) {
          setSubmissionStatus('Ready to submit');
        } else if (!navigator.onLine) {
          console.log('Internet disconnected, closing WebSocket...');
          setSubmissionStatus('Internet disconnected, attempting to reconnect...');
          if (ws.current.readyState !== WebSocket.CLOSED) {
            ws.current.close(1000, 'Internet disconnected');
          }
        }
      }
    }, 1000);
  
    const handleOffline = () => {
      if (!isMounted) return;
      console.log('Internet disconnected');
      setSubmissionStatus('Internet disconnected, attempting to reconnect...');
      if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
        ws.current.close(1006, 'Internet disconnected');
      }
    };
  
    const handleOnline = () => {
      if (!isMounted) return;
      console.log('Internet restored, attempting to reconnect...');
      setSubmissionStatus('Connecting to server...');
      connectWebSocket();
    };
  
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
  
    return () => {
      isMounted = false;
      console.log('Cleaning up WebSocket');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (monitorInterval) {
        clearInterval(monitorInterval);
      }
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close(1000, 'Component unmounted');
      }
    };
  }, [token, id]);

  useEffect(() => {
    const fetchProblem = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/problems/${id}`);
        if (response.status == 500) {
          throw new Error(`Failed to fetch problem: ${response.statusText}`);
        }
        if (response.status === 404) {
          router.push('/error/error')
        }

        const data = await response.json();
        setData(data);

      } catch (error) {
        console.error('Error fetching problem:', error);
        setSubmissionStatus('Error loading problem data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProblem();
  }, [id, router]);

  useEffect(() => {
    if (latestResultRef.current) {
      latestResultRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [results]);

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

  if (isLoading) {
    return <div className="bg-purple-200 text-gray-800 font-mono flex justify-center items-center h-screen text-xl">Loading...</div>;
  }

  return (
    <div className="bg-purple-200 min-h-screen">
      <Topbar />
      <div className="grid grid-cols-5 justify-items-center w-full gap-3 p-4">
        <div className="col-span-5 md:col-span-2 w-full px-4 pt-4">
          <h1 className="text-2xl font-mono text-gray-800 font-semibold mb-6">{data?.title}</h1>
          <p className="text-sm font-thin text-gray-800 pb-2">
            Difficulty: <span className="font-semibold">{data?.difficulty}</span>
          </p>
          <p className="text-sm font-thin text-gray-800 pb-2">
            Tags: <span className="font-semibold">{data?.tags}</span>
          </p>
          <p className="text-sm font-sans text-black pb-3">Description:</p>
          <p style={{ whiteSpace: 'pre-line' }} className="text-md font-mono text-gray-800">
            {data?.description}
          </p>
        </div>
        <div className="col-span-5 md:col-span-3 w-full h-full flex flex-col px-4 md:px-0">
          <div className="mb-2 flex justify-between items-center">
            <select
              className="p-2 text-gray-800 bg-purple-200 border border-2 border-gray-800 rounded-lg hover:bg-gray-800 hover:text-gray-200"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as 'javascript' | 'cpp' | 'python')}
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
            value={data?.boilerplate[selectedLanguage]}
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
