/**
 * ExportButton Component - Task Export Functionality
 * Phase 5, Task 5 - Data Portability
 *
 * Features:
 * - Export tasks in JSON, CSV, or YAML format
 * - Download as file attachment
 * - Project filtering support
 * - Loading states and error handling
 */

import React, { useState } from 'react';
import { Download, FileDown, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  projectId?: number;
  className?: string;
}

type ExportFormat = 'json' | 'csv' | 'yaml';

export const ExportButton: React.FC<ExportButtonProps> = ({
  projectId,
  className = ''
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setError(null);
    setShowFormatMenu(false);

    try {
      // Build export URL with query params
      const params = new URLSearchParams({ format });
      if (projectId) {
        params.append('project_id', projectId.toString());
      }

      const url = `/api/v1/export/tasks?${params.toString()}`;

      // Fetch export file
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Export failed');
      }

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename=(.+)/);
      const filename = filenameMatch
        ? filenameMatch[1].replace(/"/g, '')
        : `tasks_export.${format}`;

      // Download file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Success notification
      console.log(`Exported ${filename} successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Export Button */}
      <button
        onClick={() => setShowFormatMenu(!showFormatMenu)}
        disabled={isExporting}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export Tasks
          </>
        )}
      </button>

      {/* Format Selection Menu */}
      {showFormatMenu && !isExporting && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="py-1">
            <button
              onClick={() => handleExport('json')}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
            >
              <FileDown className="w-4 h-4 text-blue-600" />
              <span>JSON</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
            >
              <FileDown className="w-4 h-4 text-green-600" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExport('yaml')}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
            >
              <FileDown className="w-4 h-4 text-purple-600" />
              <span>YAML</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute right-0 mt-2 w-64 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg z-10">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overlay to close menu */}
      {showFormatMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowFormatMenu(false)}
        />
      )}
    </div>
  );
};

export default ExportButton;
