const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../extension/options.css');
let c = fs.readFileSync(p, 'utf8');

const reps = [
  [/background: #F8FAFC/g, 'background: var(--bg-surface-muted)'],
  [/background: #FFFFFF/g, 'background: var(--bg-surface)'],
  [/background: #F1F5F9/g, 'background: var(--bg-elevated)'],
  [/background: #EFF6FF/g, 'background: var(--accent-soft)'],
  [/background: #ECFDF5/g, 'background: var(--success-soft)'],
  [/background: #FEF2F2/g, 'background: var(--danger-soft)'],
  [/background: #FFFBEB/g, 'background: var(--warning-soft)'],
  [/background: #0F172A/g, 'background: var(--bg-input-log)'],
  [/background: #2563EB/g, 'background: var(--accent)'],
  [/background: #1D4ED8/g, 'background: var(--accent-hover)'],
  [/background: #CBD5E1/g, 'background: var(--switch-bg)'],
  [/background: #10B981/g, 'background: var(--success)'],
  [
    /background: linear-gradient\(145deg, #EFF6FF, #DBEAFE\)/g,
    'background: var(--brand-mark-bg)'
  ],
  [/color: #0F172A/g, 'color: var(--text-heading)'],
  [/color: #1E293B/g, 'color: var(--text-primary)'],
  [/color: #64748B/g, 'color: var(--text-secondary)'],
  [/color: #475569/g, 'color: var(--text-label)'],
  [/color: #94A3B8/g, 'color: var(--text-muted)'],
  [/color: #334155/g, 'color: var(--text-subtle)'],
  [/color: #2563EB/g, 'color: var(--accent)'],
  [/color: #10B981/g, 'color: var(--success)'],
  [/color: #059669/g, 'color: var(--success-text)'],
  [/color: #047857/g, 'color: var(--toast-success-text)'],
  [/color: #B91C1C/g, 'color: var(--danger)'],
  [/color: #92400E/g, 'color: var(--warning-text)'],
  [/color: #B45309/g, 'color: var(--warning-preview)'],
  [/color: #CBD5E1/g, 'color: var(--input-log-text)'],
  [/color: #FFFFFF/g, 'color: var(--text-on-accent)'],
  [/color: #D97706/g, 'color: var(--icon-amber)'],
  [/border: 1px solid #E2E8F0/g, 'border: 1px solid var(--border)'],
  [/border: 2px solid #E2E8F0/g, 'border: 2px solid var(--border)'],
  [/border-color: #E2E8F0/g, 'border-color: var(--border)'],
  [/border-color: #CBD5E1/g, 'border-color: var(--border-strong)'],
  [/border-color: #2563EB/g, 'border-color: var(--accent)'],
  [/border-color: #93C5FD/g, 'border-color: var(--accent-border)'],
  [/border-color: #1E293B/g, 'border-color: var(--input-log-border)'],
  [/border-color: #334155/g, 'border-color: var(--border)'],
  [/border: 1px solid #A7F3D0/g, 'border: 1px solid var(--success-border)'],
  [/border: 1px solid #FECACA/g, 'border: 1px solid var(--danger-border)'],
  [/border: 1px solid #FDE68A/g, 'border: 1px solid var(--warning-border)'],
  [/box-shadow: 0 1px 2px rgba\(15, 23, 42, 0.04\)/g, 'box-shadow: var(--shadow-sm)'],
  [/box-shadow: 0 0 0 3px rgba\(37, 99, 235, 0.12\)/g, 'box-shadow: 0 0 0 3px var(--accent-focus)'],
  [/box-shadow: 0 0 0 3px rgba\(51, 65, 85, 0.4\)/g, 'box-shadow: 0 0 0 3px var(--input-log-focus)'],
  [/box-shadow: inset 0 0 0 3px #EFF6FF/g, 'box-shadow: inset 0 0 0 3px var(--mode-check-inset)']
];

for (const [from, to] of reps) {
  c = c.replace(from, to);
}

c = c.replace(
  /\.card-icon--blue \{ background: var\(--accent-soft\); color: var\(--accent\); \}/,
  '.card-icon--blue { background: var(--icon-blue-bg); color: var(--icon-blue); }'
);
c = c.replace(
  /\.card-icon--green \{ background: var\(--success-soft\); color: var\(--success\); \}/,
  '.card-icon--green { background: var(--icon-green-bg); color: var(--icon-green); }'
);
c = c.replace(
  /\.card-icon--slate \{ background: var\(--bg-elevated\); color: var\(--text-label\); \}/,
  '.card-icon--slate { background: var(--icon-slate-bg); color: var(--icon-slate); }'
);
c = c.replace(
  /\.card-icon--amber \{ background: var\(--warning-soft\); color: var\(--icon-amber\); \}/,
  '.card-icon--amber { background: var(--icon-amber-bg); color: var(--icon-amber); }'
);

c = c.replace(
  /body \{[\s\S]*?line-height: 1.5;\n\}/,
  `body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}`
);

c = c.replace(
  /\.toast\.success \{[\s\S]*?\}/,
  `.toast.success {
  background: var(--toast-success-bg);
  border: 1px solid var(--toast-success-border);
  color: var(--toast-success-text);
}`
);

c = c.replace(
  /\.toast\.error \{[\s\S]*?\}/,
  `.toast.error {
  background: var(--toast-error-bg);
  border: 1px solid var(--toast-error-border);
  color: var(--toast-error-text);
}`
);

c = c.replace(
  /\.field-hint code \{[\s\S]*?\}/,
  `.field-hint code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--code-bg);
  font-size: 11px;
  color: var(--text-label);
}`
);

c = c.replace(
  /\.preset-check code \{[\s\S]*?\}/,
  `.preset-check code {
  font-size: 12px;
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 4px;
}`
);

fs.writeFileSync(p, c);
console.log('Updated', p);
