const lines = [
  '',
  'Seed scaffold is ready.',
  '',
  'Run this SQL file in Supabase SQL Editor after migrations:',
  'supabase/seeds/20260306110000_seed_demo_data.sql',
  '',
  'Notes:',
  '- It seeds only when at least one auth user exists.',
  '- It is idempotent and safe to rerun.',
  '- Document rows are metadata placeholders.',
  '',
];

process.stdout.write(lines.join('\n'));
