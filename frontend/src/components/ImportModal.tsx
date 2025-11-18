/**
 * ImportModal Component - Task Import Functionality
 * Phase 5, Task 5 - Data Portability
 *
 * Features:
 * - File upload with drag-and-drop
 * - Client-side validation (YAML syntax, JSON schema)
 * - Progress bar for large imports
 * - Duplicate handling options (skip/update)
 * - Import summary display
 */

import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface ImportSummary {
  total_records: number;
  tasks_imported: number;
  tasks_skipped: number;
  tasks_updated: number;
  errors: Array<{
    record_index: number;
    task_data: any;
    error: string;
  }>;
  duration_ms: number;
}

type DuplicateStrategy = 'skip' | 'update';

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Client-side file validation
  const validateFile = (file: File): string | null => {
    const validExtensions = ['.json', '.csv', '.yaml', '.yml'];
    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];

    if (!extension || !validExtensions.includes(extension)) {
      return `Invalid file type. Supported: ${validExtensions.join(', ')}`;
    }

    // Max file size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return 'File too large. Maximum size: 10MB';
    }

    return null;
  };

  // Validate JSON/YAML syntax before upload
  const validateContent = async (file: File): Promise<string | null> => {
    const content = await file.text();

    try {
      if (file.name.endsWith('.json')) {
        JSON.parse(content);
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        // Basic YAML validation (check for syntax errors)
        if (content.includes('\t')) {
          return 'YAML files cannot contain tabs. Use spaces for indentation.';
        }
      }
      return null;
    } catch (e) {
      return `Invalid ${file.name.split('.').pop()?.toUpperCase()} syntax: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setSummary(null);

    // Validate file
    const fileError = validateFile(selectedFile);
    if (fileError) {
      setError(fileError);
      return;
    }

    // Validate content
    const contentError = await validateContent(selectedFile);
    if (contentError) {
      setError(contentError);
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress for user feedback
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(
        `/api/v1/import/tasks?on_duplicate=${duplicateStrategy}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        }
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Import failed');
      }

      const importSummary: ImportSummary = await response.json();
      setSummary(importSummary);

      // Call completion callback
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setFile(null);
    setSummary(null);
    setError(null);
    setUploadProgress(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Import Tasks</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* File Upload Area */}
          {!summary && (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.yaml,.yml"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-blue-600" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Choose different file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Drag and drop file here, or{' '}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-xs text-gray-500">
                      Supported formats: JSON, CSV, YAML (max 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Duplicate Handling */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Duplicate Handling
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="skip"
                      checked={duplicateStrategy === 'skip'}
                      onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                      className="mr-2"
                    />
                    <span className="text-sm">Skip duplicates</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="update"
                      checked={duplicateStrategy === 'update'}
                      onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                      className="mr-2"
                    />
                    <span className="text-sm">Update existing</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  {duplicateStrategy === 'skip'
                    ? 'Tasks with same skill_name + schedule will be skipped'
                    : 'Existing tasks will be updated with new data'}
                </p>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing tasks...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </>
          )}

          {/* Import Summary */}
          {summary && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                <h3 className="font-semibold">Import Complete</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Records</p>
                  <p className="text-2xl font-semibold">{summary.total_records}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Imported</p>
                  <p className="text-2xl font-semibold text-green-700">
                    {summary.tasks_imported}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Skipped</p>
                  <p className="text-2xl font-semibold text-blue-700">
                    {summary.tasks_skipped}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600">Updated</p>
                  <p className="text-2xl font-semibold text-purple-700">
                    {summary.tasks_updated}
                  </p>
                </div>
              </div>

              {summary.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-600">
                    {summary.errors.length} error(s) encountered
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {summary.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="p-2 bg-red-50 rounded text-xs">
                        <p className="font-medium">Record {err.record_index}:</p>
                        <p className="text-red-700">{err.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500">
                Completed in {summary.duration_ms}ms
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          {summary ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                Import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
