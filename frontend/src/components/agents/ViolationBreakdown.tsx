import React, { useState } from 'react';
import { Card } from '../design-system/Card';
import { Badge } from '../design-system/Badge';
import { Input } from '../design-system/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../design-system/Select';

interface Violation {
  id: string;
  type: 'god_objects' | 'parameter_bombs' | 'complexity' | 'nesting' | 'long_functions' | 'magic_literals';
  severity: 'high' | 'medium' | 'low';
  count: number;
  trend: number;
  threshold: string;
  description: string;
}

interface ViolationBreakdownProps {
  violations: Violation[];
  onViolationClick: (violationId: string) => void;
}

const violationConfig = {
  god_objects: {
    name: 'God Objects',
    color: '#f44336',
    description: 'Classes with too many methods (>15)'
  },
  parameter_bombs: {
    name: 'Parameter Bombs',
    color: '#ff9800',
    description: 'Functions with too many parameters (>6 NASA limit)'
  },
  complexity: {
    name: 'Cyclomatic Complexity',
    color: '#ff5722',
    description: 'Functions with high complexity (>10)'
  },
  nesting: {
    name: 'Deep Nesting',
    color: '#ff6f00',
    description: 'Code with excessive nesting (>4 NASA limit)'
  },
  long_functions: {
    name: 'Long Functions',
    color: '#fbc02d',
    description: 'Functions exceeding line count (>50 lines)'
  },
  magic_literals: {
    name: 'Magic Literals',
    color: '#9c27b0',
    description: 'Hardcoded values without named constants'
  }
};

const ViolationBreakdown: React.FC<ViolationBreakdownProps> = ({ violations, onViolationClick }) => {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const getSeverityVariant = (severity: string): 'error' | 'warning' | 'default' => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const filteredViolations = violations.filter(violation => {
    const matchesSeverity = severityFilter === 'all' || violation.severity === severityFilter;
    const matchesSearch = violation.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         violationConfig[violation.type].name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search violations"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-grow"
        />
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredViolations.map((violation) => {
          const config = violationConfig[violation.type];
          return (
            <Card
              key={violation.id}
              hover
              className="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-lg"
              onClick={() => onViolationClick(violation.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {config.name}
                  </h3>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onViolationClick(violation.id); }}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4"/>
                    <path d="M12 8h.01"/>
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-4xl font-bold" style={{ color: config.color }}>
                  {violation.count}
                </p>
                <p className="text-xs text-text-secondary">occurrences</p>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Badge variant={getSeverityVariant(violation.severity)}>
                  {violation.severity.toUpperCase()}
                </Badge>
                {violation.trend !== 0 && (
                  <div className="flex items-center gap-1">
                    {violation.trend > 0 ? (
                      <svg className="w-4 h-4 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                        <polyline points="17 6 23 6 23 12"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
                        <polyline points="17 18 23 18 23 12"/>
                      </svg>
                    )}
                    <span className={`text-xs ${violation.trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {Math.abs(violation.trend)} this week
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-surface-hover p-3 rounded mb-2">
                <p className="text-xs text-text-secondary mb-1">Threshold:</p>
                <p className="text-sm font-semibold text-text-primary">{violation.threshold}</p>
              </div>

              <p className="text-sm text-text-secondary">{config.description}</p>
            </Card>
          );
        })}
      </div>

      {filteredViolations.length === 0 && (
        <div className="text-center py-12">
          <h4 className="text-lg font-semibold text-text-secondary mb-2">
            No violations found
          </h4>
          <p className="text-sm text-text-secondary">
            {searchQuery || severityFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Great job! Your code quality is excellent'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ViolationBreakdown;
