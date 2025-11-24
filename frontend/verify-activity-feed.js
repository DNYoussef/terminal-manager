// Verification script for Activity Feed implementation

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'src/components/agents/ActivityFeed.tsx',
  'src/components/agents/EventCard.tsx',
  'src/components/agents/EventFilters.tsx',
  'src/components/agents/index.ts',
  'src/hooks/useAgentStream.ts',
];

const REQUIRED_EXPORTS = {
  'src/components/agents/index.ts': [
    'ActivityFeed',
    'EventCard',
    'EventFilters',
    'EventFiltersState',
  ],
  'src/hooks/useAgentStream.ts': [
    'useAgentStream',
    'AgentEvent',
    'AgentStreamOptions',
    'UseAgentStreamReturn',
  ],
};

const EVENT_TYPES = [
  'agent_spawned',
  'operation_allowed',
  'operation_denied',
  'budget_updated',
  'quality_gate_passed',
  'quality_gate_failed',
  'task_completed',
  'task_failed',
];

console.log('Verifying Activity Feed Implementation...\n');

let errors = 0;

// Check file existence
console.log('1. Checking required files...');
REQUIRED_FILES.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`  ✓ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`  ✗ ${file} - MISSING`);
    errors++;
  }
});

// Check exports
console.log('\n2. Checking exports...');
Object.entries(REQUIRED_EXPORTS).forEach(([file, exports]) => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    exports.forEach(exp => {
      if (content.includes(exp)) {
        console.log(`  ✓ ${file} exports ${exp}`);
      } else {
        console.log(`  ✗ ${file} missing export: ${exp}`);
        errors++;
      }
    });
  }
});

// Check event types
console.log('\n3. Checking event types...');
const eventCardPath = path.join(__dirname, 'src/components/agents/EventCard.tsx');
if (fs.existsSync(eventCardPath)) {
  const content = fs.readFileSync(eventCardPath, 'utf8');
  EVENT_TYPES.forEach(type => {
    if (content.includes(type)) {
      console.log(`  ✓ Event type: ${type}`);
    } else {
      console.log(`  ✗ Missing event type: ${type}`);
      errors++;
    }
  });
}

// Check WebSocket implementation
console.log('\n4. Checking WebSocket implementation...');
const hookPath = path.join(__dirname, 'src/hooks/useAgentStream.ts');
if (fs.existsSync(hookPath)) {
  const content = fs.readFileSync(hookPath, 'utf8');
  
  const wsFeatures = [
    'new WebSocket',
    'ws.onopen',
    'ws.onmessage',
    'ws.onerror',
    'ws.onclose',
    'autoReconnect',
    'reconnectDelay',
    'bufferSize',
    'batchInterval',
  ];
  
  wsFeatures.forEach(feature => {
    if (content.includes(feature)) {
      console.log(`  ✓ WebSocket feature: ${feature}`);
    } else {
      console.log(`  ✗ Missing WebSocket feature: ${feature}`);
      errors++;
    }
  });
}

// Check filter implementation
console.log('\n5. Checking filter implementation...');
const filtersPath = path.join(__dirname, 'src/components/agents/EventFilters.tsx');
if (fs.existsSync(filtersPath)) {
  const content = fs.readFileSync(filtersPath, 'utf8');
  
  const filterFeatures = [
    'eventTypes',
    'agents',
    'statuses',
    'searchQuery',
    'timeRange',
    'toggleEventType',
    'toggleAgent',
    'toggleStatus',
    'clearAllFilters',
  ];
  
  filterFeatures.forEach(feature => {
    if (content.includes(feature)) {
      console.log(`  ✓ Filter feature: ${feature}`);
    } else {
      console.log(`  ✗ Missing filter feature: ${feature}`);
      errors++;
    }
  });
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0) {
  console.log('✓ All checks passed!');
  console.log('Activity Feed implementation is complete and ready.');
  process.exit(0);
} else {
  console.log(`✗ ${errors} error(s) found.`);
  console.log('Please fix the issues above.');
  process.exit(1);
}
