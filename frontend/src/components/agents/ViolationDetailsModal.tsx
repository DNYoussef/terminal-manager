import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../design-system/Dialog';
import { Button } from '../design-system/Button';
import { Badge } from '../design-system/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../design-system/Tabs';
import { Card } from '../design-system/Card';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ViolationDetail {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  file_path: string;
  line_number: number;
  code_snippet: string;
  context: {
    before: string[];
    after: string[];
  };
  suggested_fix: {
    description: string;
    code: string;
    explanation: string;
  };
  historical_occurrences: {
    date: string;
    agent: string;
    fixed: boolean;
  }[];
  threshold_info: {
    current: number;
    threshold: number;
    unit: string;
  };
}

interface ViolationDetailsModalProps {
  violationId: string | null;
  onClose: () => void;
}

const ViolationDetailsModal: React.FC<ViolationDetailsModalProps> = ({ violationId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<ViolationDetail | null>(null);
  const [activeTab, setActiveTab] = useState('context');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (violationId) {
      fetchViolationDetails();
    }
  }, [violationId]);

  const fetchViolationDetails = async () => {
    if (!violationId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/metrics/violations/${violationId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch violation details: ${response.statusText}`);
      }

      const data = await response.json();
      setDetails(data);

    } catch (err) {
      console.error('Error fetching violation details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load violation details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#ffc107';
      default: return '#9e9e9e';
    }
  };

  const getSeverityVariant = (severity: string): 'error' | 'warning' | 'default' => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      default: return 'default';
    }
  };

  const renderCodeWithContext = () => {
    if (!details) return null;

    const fullCode = [
      ...details.context.before,
      details.code_snippet,
      ...details.context.after
    ].join('\n');

    return (
      <div className="relative">
        <button
          onClick={() => handleCopyCode(fullCode)}
          className="absolute top-2 right-2 px-3 py-1 rounded bg-black/50 text-white text-sm hover:bg-black/70 transition-colors z-10"
        >
          {copied ? 'Copied!' : 'Copy code'}
        </button>
        <SyntaxHighlighter
          language="typescript"
          style={vscDarkPlus}
          showLineNumbers
          startingLineNumber={details.line_number - details.context.before.length}
          wrapLines
          lineProps={(lineNumber) => {
            const isViolationLine = lineNumber === details.line_number;
            return {
              style: {
                backgroundColor: isViolationLine ? 'rgba(255, 0, 0, 0.2)' : 'transparent',
                display: 'block'
              }
            };
          }}
        >
          {fullCode}
        </SyntaxHighlighter>
      </div>
    );
  };

  const renderSuggestedFix = () => {
    if (!details?.suggested_fix) return null;

    return (
      <div className="space-y-4">
        <p className="text-text-primary">{details.suggested_fix.description}</p>
        <div className="relative mt-4">
          <button
            onClick={() => handleCopyCode(details.suggested_fix.code)}
            className="absolute top-2 right-2 px-3 py-1 rounded bg-black/50 text-white text-sm hover:bg-black/70 transition-colors z-10"
          >
            {copied ? 'Copied!' : 'Copy fix'}
          </button>
          <SyntaxHighlighter
            language="typescript"
            style={vscDarkPlus}
            showLineNumbers
          >
            {details.suggested_fix.code}
          </SyntaxHighlighter>
        </div>
        <Card className="bg-blue-50 border-blue-200">
          <p className="text-sm text-text-primary">
            <strong>Explanation:</strong> {details.suggested_fix.explanation}
          </p>
        </Card>
      </div>
    );
  };

  const renderHistory = () => {
    if (!details?.historical_occurrences || details.historical_occurrences.length === 0) {
      return (
        <p className="text-text-secondary text-sm">
          No historical occurrences found
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {details.historical_occurrences.map((occurrence, idx) => (
          <Card
            key={idx}
            className={`border-2 ${occurrence.fixed ? 'border-green-500 bg-green-50' : 'border-orange-500 bg-orange-50'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">
                  <strong>Agent:</strong> {occurrence.agent}
                </p>
                <p className="text-xs text-text-secondary">
                  {new Date(occurrence.date).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={occurrence.fixed ? 'success' : 'warning'}>
                {occurrence.fixed ? 'Fixed' : 'Unresolved'}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={!!violationId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Violation Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex justify-center p-8">
              <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
              {error}
            </div>
          )}

          {details && !loading && (
            <>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant={getSeverityVariant(details.severity)}>
                    {details.type.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    Severity: {details.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-text-primary">{details.description}</p>
                <p className="text-sm text-text-secondary">
                  File: {details.file_path} (Line {details.line_number})
                </p>
              </div>

              <Card className="bg-orange-50 border-orange-200">
                <p className="text-sm text-text-primary">
                  <strong>Threshold Violation:</strong> Current value is{' '}
                  <strong>{details.threshold_info.current} {details.threshold_info.unit}</strong>,
                  exceeding the threshold of{' '}
                  <strong>{details.threshold_info.threshold} {details.threshold_info.unit}</strong>
                </p>
              </Card>

              <div className="border-t border-border my-4"></div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="context">Code Context</TabsTrigger>
                  <TabsTrigger value="fix">Suggested Fix</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="context">
                  {renderCodeWithContext()}
                </TabsContent>

                <TabsContent value="fix">
                  {renderSuggestedFix()}
                </TabsContent>

                <TabsContent value="history">
                  {renderHistory()}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {details && (
            <Button
              variant="primary"
              onClick={() => {
                if (details.suggested_fix?.code) {
                  handleCopyCode(details.suggested_fix.code);
                }
              }}
            >
              Apply Suggested Fix
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViolationDetailsModal;
